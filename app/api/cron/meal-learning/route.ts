import { NextRequest, NextResponse } from "next/server";
import { createClient as createSanityClient } from "@sanity/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRow = {
    id: string;
    date: string;
    status: string | null;
    company_id?: string | null;
    location_id?: string | null;
};

type MenuDayRow = {
    date: string;
    mealId?: string;
    mealTitle?: string;
};

type MealStats = {
    mealId: string;
    mealTitle?: string;
    orderedCount: number;
    cancelledCount: number;
    totalCount: number;
    dates: Set<string>;
};

function makeRid() {
    return `meal_learning_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function jsonOk(rid: string, data: Record<string, unknown>, status = 200) {
    return NextResponse.json({ ok: true, rid, ...data }, { status });
}

function jsonError(
    rid: string,
    error: string,
    status = 500,
    extra?: Record<string, unknown>
) {
    return NextResponse.json(
        {
            ok: false,
            rid,
            error,
            message: error,
            status,
            ...(extra ?? {}),
        },
        { status }
    );
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Mangler miljøvariabel: ${name}`);
    return value;
}

function clamp(value: number, min = 1, max = 100) {
    return Math.max(min, Math.min(max, Math.round(value)));
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
}

function isCancelledStatus(status?: string | null) {
    const normalized = (status ?? "").toLowerCase().trim();

    return [
        "cancelled",
        "canceled",
        "cancelled_by_user",
        "cancelled_by_admin",
        "avbestilt",
        "canceled_by_user",
    ].includes(normalized);
}

function isActiveOrderStatus(status?: string | null) {
    if (!status) return true;
    if (isCancelledStatus(status)) return false;

    const normalized = status.toLowerCase().trim();

    return [
        "active",
        "ordered",
        "confirmed",
        "registered",
        "pending",
        "completed",
        "delivered",
        "bestilt",
        "registrert",
    ].includes(normalized);
}

function calculateScores(stats: MealStats, maxOrdered: number) {
    const orderedCount = stats.orderedCount;
    const cancelledCount = stats.cancelledCount;
    const totalCount = Math.max(stats.totalCount, 1);
    const cancelRate = cancelledCount / totalCount;
    const relativePopularity = maxOrdered > 0 ? orderedCount / maxOrdered : 0;

    const popularityScore = clamp(35 + relativePopularity * 65);
    const wasteScore = clamp(20 + cancelRate * 80);
    const repeatRiskScore = clamp(25 + Math.min(stats.dates.size, 8) * 8);
    const customerFitScore = clamp(popularityScore * 0.7 + (100 - wasteScore) * 0.3);

    return {
        popularityScore,
        wasteScore,
        repeatRiskScore,
        customerFitScore,
        lastFeedbackSummary:
            `Auto-beregnet fra ordredata: ${orderedCount} aktive bestillinger, ` +
            `${cancelledCount} avbestillinger, ${stats.dates.size} meny-dager analysert.`,
        lastCalculatedAt: new Date().toISOString(),
    };
}

export async function GET(req: NextRequest) {
    const rid = makeRid();

    try {
        const cronSecret = process.env.CRON_SECRET;
        const providedSecret = req.headers.get("authorization")?.replace("Bearer ", "").trim();

        if (cronSecret && providedSecret !== cronSecret) {
            return jsonError(rid, "Unauthorized", 401);
        }

        const daysParam = Number(req.nextUrl.searchParams.get("days") ?? 56);
        const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 56;

        const fromDate = daysAgoISO(days);
        const toDate = todayISO();

        const supabase = createSupabaseClient(
            requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
            requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            }
        );

        const sanity = createSanityClient({
            projectId:
                process.env.SANITY_PROJECT_ID ??
                process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
                requireEnv("NEXT_PUBLIC_SANITY_PROJECT_ID"),
            dataset: process.env.SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
            apiVersion: "2024-01-01",
            token: requireEnv("SANITY_API_TOKEN"),
            useCdn: false,
        });

        const { data: orders, error: ordersError } = await supabase
            .from("orders")
            .select("id,date,status,company_id,location_id")
            .gte("date", fromDate)
            .lte("date", toDate);

        if (ordersError) {
            throw new Error(`Supabase orders-feil: ${ordersError.message}`);
        }

        const safeOrders = (orders ?? []) as OrderRow[];
        const dates = Array.from(new Set(safeOrders.map((order) => order.date).filter(Boolean)));

        if (dates.length === 0) {
            return jsonOk(rid, {
                message: "Ingen ordredata i perioden.",
                fromDate,
                toDate,
                ordersRead: safeOrders.length,
                menuDaysMatched: 0,
                mealsAnalyzed: 0,
                updatedMeals: 0,
            });
        }

        const menuDays = await sanity.fetch<MenuDayRow[]>(
            `*[
        _type == "menuDay" &&
        date in $dates &&
        defined(mealRef._ref)
      ]{
        date,
        "mealId": mealRef._ref,
        mealTitle
      }`,
            { dates }
        );

        const menuByDate = new Map<string, MenuDayRow>();

        for (const day of menuDays ?? []) {
            if (day.date && day.mealId) {
                menuByDate.set(day.date, day);
            }
        }

        const statsByMeal = new Map<string, MealStats>();

        for (const order of safeOrders) {
            const menuDay = menuByDate.get(order.date);
            if (!menuDay?.mealId) continue;

            const mealId = menuDay.mealId;

            const existing =
                statsByMeal.get(mealId) ??
                ({
                    mealId,
                    mealTitle: menuDay.mealTitle,
                    orderedCount: 0,
                    cancelledCount: 0,
                    totalCount: 0,
                    dates: new Set<string>(),
                } satisfies MealStats);

            existing.totalCount += 1;
            existing.dates.add(order.date);

            if (isCancelledStatus(order.status)) {
                existing.cancelledCount += 1;
            } else if (isActiveOrderStatus(order.status)) {
                existing.orderedCount += 1;
            }

            statsByMeal.set(mealId, existing);
        }

        const stats = Array.from(statsByMeal.values());
        const maxOrdered = Math.max(...stats.map((item) => item.orderedCount), 0);

        let updatedMeals = 0;

        for (const item of stats) {
            const aiMenuLearning = calculateScores(item, maxOrdered);

            await sanity
                .patch(item.mealId)
                .set({ aiMenuLearning })
                .commit({ autoGenerateArrayKeys: true });

            updatedMeals += 1;
        }

        return jsonOk(rid, {
            fromDate,
            toDate,
            ordersRead: safeOrders.length,
            menuDaysMatched: menuByDate.size,
            mealsAnalyzed: stats.length,
            updatedMeals,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        console.error("[cron/meal-learning]", { rid, error });

        return jsonError(rid, message, 500);
    }
}