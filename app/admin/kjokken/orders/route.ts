export async function GET() {
  return Response.json(
    {
      ok: false,
      error: "GONE",
      message: "Denne legacy-ruten er avviklet. Bruk /kitchen.",
    },
    { status: 410 }
  );
}
