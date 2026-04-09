import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Stack, Text, Button, Grid, Flex, Badge, Spinner } from "@sanity/ui";
import { useClient } from "sanity";

function osloTodayISO() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function startOfWeekISO(osloISO: string) {
  const d = new Date(osloISO + "T12:00:00Z");
  const day = d.getUTCDay();
  const diffToMon = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMon);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type DayDoc = {
  _id: string;
  date: string;
  description?: string;
  allergens?: string[];
  approvedForPublish?: boolean;
  customerVisible?: boolean;
};

export default function WeekPlanner() {
  const client = useClient({ apiVersion: "2024-01-01" });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [week1, setWeek1] = useState<DayDoc[]>([]);
  const [week2, setWeek2] = useState<DayDoc[]>([]);

  const ranges = useMemo(() => {
    const today = osloTodayISO();
    const w1Start = startOfWeekISO(today);
    const w1EndEx = addDaysISO(w1Start, 7);
    const w2Start = w1EndEx;
    const w2EndEx = addDaysISO(w2Start, 7);
    return {
      week1: { from: w1Start, toEx: w1EndEx },
      week2: { from: w2Start, toEx: w2EndEx },
    };
  }, []);

  const fetchWeeks = useCallback(async () => {
    setLoading(true);
    try {
      const [w1, w2] = await Promise.all([
        client.fetch(
          `*[_type=="menuDay" && date >= $from && date < $to && !(_id in path("drafts.**"))]
           | order(date asc){
             _id, date, description, allergens, approvedForPublish, customerVisible
           }`,
          { from: ranges.week1.from, to: ranges.week1.toEx }
        ),
        client.fetch(
          `*[_type=="menuDay" && date >= $from && date < $to && !(_id in path("drafts.**"))]
           | order(date asc){
             _id, date, description, allergens, approvedForPublish, customerVisible
           }`,
          { from: ranges.week2.from, to: ranges.week2.toEx }
        ),
      ]);

      setWeek1(w1 || []);
      setWeek2(w2 || []);
    } finally {
      setLoading(false);
    }
  }, [client, ranges]);

  useEffect(() => {
    fetchWeeks();
  }, [fetchWeeks]);

  const approveWeek2 = useCallback(async () => {
    setBusy("approve");
    try {
      const ids = week2.map((d) => d._id);
      const now = new Date().toISOString();

      let tx = client.transaction();
      for (const id of ids) {
        tx = tx.patch(id, { set: { approvedForPublish: true, approvedAt: now } });
      }
      await tx.commit();

      await fetchWeeks();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Feil ved godkjenning av uke 2");
    } finally {
      setBusy(null);
    }
  }, [client, week2, fetchWeeks]);

  const revokeWeek2 = useCallback(async () => {
    setBusy("revoke");
    try {
      const ids = week2.map((d) => d._id);

      let tx = client.transaction();
      for (const id of ids) {
        tx = tx.patch(id, { set: { approvedForPublish: false }, unset: ["approvedAt"] });
      }
      await tx.commit();

      await fetchWeeks();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Feil ved å trekke godkjenning");
    } finally {
      setBusy(null);
    }
  }, [client, week2, fetchWeeks]);

  const stats = useMemo(() => {
    const w1Approved = week1.filter((d) => d.approvedForPublish).length;
    const w1Visible = week1.filter((d) => d.customerVisible).length;
    const w2Approved = week2.filter((d) => d.approvedForPublish).length;
    const w2Visible = week2.filter((d) => d.customerVisible).length;
    return { w1Approved, w1Visible, w2Approved, w2Visible };
  }, [week1, week2]);

  return (
    <Stack space={4}>
      <Card padding={4} radius={2} shadow={1} tone="transparent">
        <Stack space={3}>
          <Flex justify="space-between" align="center">
            <Stack space={1}>
              <Text weight="semibold" size={2}>Ukeplan (kontroll + automatikk)</Text>
              <Text size={1} muted>
                Uke 2 blir synlig automatisk torsdag kl. 08:00 (kun hvis godkjent). Uke 1 skjules automatisk fredag kl. 15:00.
              </Text>
            </Stack>

            <Flex gap={2}>
              <Button
                tone="positive"
                text={busy === "approve" ? "Godkjenner..." : "Godkjenn uke 2"}
                disabled={!!busy || loading || week2.length === 0}
                onClick={approveWeek2}
              />
              <Button
                tone="critical"
                text={busy === "revoke" ? "Opphever..." : "Trekk godkjenning"}
                disabled={!!busy || loading || week2.length === 0}
                onClick={revokeWeek2}
              />
              <Button
                text="Oppdater"
                disabled={!!busy || loading}
                onClick={fetchWeeks}
              />
            </Flex>
          </Flex>

          <Flex gap={2} wrap="wrap">
            <Badge tone={stats.w1Approved === 5 ? "positive" : "caution"}>Uke 1 godkjent: {stats.w1Approved}/5</Badge>
            <Badge tone={stats.w1Visible > 0 ? "positive" : "default"}>Uke 1 synlig: {stats.w1Visible}/5</Badge>
            <Badge tone={stats.w2Approved === 5 ? "positive" : "caution"}>Uke 2 godkjent: {stats.w2Approved}/5</Badge>
            <Badge tone={stats.w2Visible > 0 ? "positive" : "default"}>Uke 2 synlig: {stats.w2Visible}/5</Badge>
            <Badge>Uke 1: {ranges.week1.from} → {addDaysISO(ranges.week1.toEx, -1)}</Badge>
            <Badge>Uke 2: {ranges.week2.from} → {addDaysISO(ranges.week2.toEx, -1)}</Badge>
          </Flex>

          {loading ? (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1} muted>Laster ukeplan…</Text>
            </Flex>
          ) : (
            <Grid columns={[1, 1, 2]} gap={4}>
              <Card padding={3} radius={2} shadow={1}>
                <Stack space={2}>
                  <Text weight="semibold">Denne uken (Uke 1)</Text>
                  {week1.length === 0 ? (
                    <Text size={1} muted>Ingen dager funnet.</Text>
                  ) : (
                    week1.map((d) => (
                      <Card key={d._id} padding={3} radius={2} tone="transparent" border>
                        <Stack space={1}>
                          <Flex justify="space-between" align="center">
                            <Text weight="semibold">{d.date}</Text>
                            <Flex gap={2}>
                              <Badge tone={d.approvedForPublish ? "positive" : "caution"}>
                                {d.approvedForPublish ? "Godkjent" : "Ikke godkjent"}
                              </Badge>
                              <Badge tone={d.customerVisible ? "positive" : "default"}>
                                {d.customerVisible ? "Synlig" : "Skjult"}
                              </Badge>
                            </Flex>
                          </Flex>
                          <Text size={1}>{d.description || "—"}</Text>
                          <Text size={1} muted>Allergener: {(d.allergens || []).join(", ") || "—"}</Text>
                        </Stack>
                      </Card>
                    ))
                  )}
                </Stack>
              </Card>

              <Card padding={3} radius={2} shadow={1}>
                <Stack space={2}>
                  <Text weight="semibold">Neste uke (Uke 2)</Text>
                  {week2.length === 0 ? (
                    <Text size={1} muted>Ingen dager funnet.</Text>
                  ) : (
                    week2.map((d) => (
                      <Card key={d._id} padding={3} radius={2} tone="transparent" border>
                        <Stack space={1}>
                          <Flex justify="space-between" align="center">
                            <Text weight="semibold">{d.date}</Text>
                            <Flex gap={2}>
                              <Badge tone={d.approvedForPublish ? "positive" : "caution"}>
                                {d.approvedForPublish ? "Godkjent" : "Ikke godkjent"}
                              </Badge>
                              <Badge tone={d.customerVisible ? "positive" : "default"}>
                                {d.customerVisible ? "Synlig" : "Skjult"}
                              </Badge>
                            </Flex>
                          </Flex>
                          <Text size={1}>{d.description || "—"}</Text>
                          <Text size={1} muted>Allergener: {(d.allergens || []).join(", ") || "—"}</Text>
                        </Stack>
                      </Card>
                    ))
                  )}
                </Stack>
              </Card>
            </Grid>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
