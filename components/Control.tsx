// components/Control.tsx
import { Container } from "@/components/ui/container";

export default function Control() {
  const items = [
    {
      title: "Bedriften er admin",
      desc: "Rammer og regler settes av firmaet – ikke av ansatte.",
    },
    {
      title: "Ingen unntakskaos",
      desc: "Systemet håndhever reglene likt for alle, hver dag.",
    },
    {
      title: "Integritet først",
      desc: "Handlinger bekreftes kun når lagring er verifisert.",
    },
    {
      title: "Skalerbart",
      desc: "Flere lokasjoner og leveringsvinduer – uten manuelle prosesser.",
    },
  ];

  return (
    <section>
      <Container className="max-w-6xl py-10">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Bygget for drift – ikke for støy
      </h2>

      <p className="mt-3 max-w-2xl text-[rgb(var(--lp-muted))]">
        Lunchportalen er utviklet for bedrifter som vil ha kontroll over lunsjordningen
        uten å bruke tid på dag-til-dag-oppfølging.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {items.map((x) => (
          <div
            key={x.title}
            className="lp-card lp-motion-card p-6"
          >
            <div className="text-sm font-semibold">{x.title}</div>
            <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
              {x.desc}
            </div>
          </div>
        ))}
      </div>
      </Container>
    </section>
  );
}


