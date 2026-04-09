# U37 Entity Actions Collections Runtime

## Landed Now
- Workspace-, modal- og block-create-flyten bruker nå samme block truth, så create-handlinger varierer mindre tilfeldig mellom add/pick/edit.
- Tree- og audit-flater viser nå tydelige operatorhandlinger når backend er degradert, i stedet for å falle tilbake til passive tomtilstander.
- Settings/system følger nå samme management-workspace-posture som øvrige settings-objekter.

## What Improved
- Handlingstyper blir tydeligere skilt mellom runtime-managed, runtime-read og code-governed flater.
- Publish-historikken er låst mot korrekt audit-action, så workspace/action-story er teknisk mer konsistent.

## What Did Not Fully Land
- U37 leverte ikke full entity-action/bulk-action-paritet på tvers av alle collections.
- Discovery, tree, header og enkelte detail-workspaces er fortsatt ikke helt like stramme som Umbraco Bellissima.
