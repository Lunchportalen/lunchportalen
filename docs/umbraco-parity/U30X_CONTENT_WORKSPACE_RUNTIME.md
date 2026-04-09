# U30X — Content workspace runtime

## Layout-hierarki (etter endring)

1. **Seksjon** (`SectionShell`): tre-kolonne `minmax(360px, 520px)` — uendret fra U29R.
2. **Content shell** (`ContentWorkspaceShell`): `minmax(320px, 480px)` venstre — **bredere** enn tidligere 280px.
3. **Tri-pane** (`ContentWorkspaceWorkspaceShell`): venstre struktur ~240–300px, senter `1.15fr`, høyre **380–520px** (inspektør).
4. **Canvas split** (`ContentWorkspaceMainCanvas`): preview-kolonne **min 520px** og høyere `fr` vekt.

## Målbare mål (subjektiv vurdering)

- Tree/venstre kolonne: merkbart bredere i content-modus.
- Preview: større (`max-w-xl` / `max-w-3xl` ved inline edit).
- Vertikal høyde: `min-h` økt for tri-pane.
