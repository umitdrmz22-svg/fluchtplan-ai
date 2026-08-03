# Fluchtplan Studio

Fluchtplan Studio ist ein vollständig browserbasierter, regelbasierter Editor für Flucht- und Rettungspläne. Die Anwendung arbeitet ohne künstliche Intelligenz und übermittelt weder Grundrisse noch Projektdaten an einen externen Dienst.

## Funktionen

- SVG-, PNG- und JPG-Grundrisse laden
- Räume und Wände direkt im Plan ergänzen
- Fluchtwege als durchgehend grüne Wegführung zeichnen
- Betrachterstandort „Sie sind hier“ setzen
- Rettungs- und Brandschutzzeichen aus dem Downloadbereich der BGHM platzieren
- Verhaltensregeln für Brandfall und Unfall bearbeiten
- A3-Plan mit Legende, Planangaben und Revisionsstand erstellen
- Projekte lokal sichern und als `.frp.json` wieder öffnen
- Regelbasierter Norm-Check mit Pflichtabweichungen und Hinweisen
- SVG-Ausgabe sowie A3-PDF über den Druckdialog

## Fachliche Grundlagen

Die Prüflogik orientiert sich insbesondere an:

- [§ 4 Abs. 4 Arbeitsstättenverordnung](https://www.gesetze-im-internet.de/arbst_ttv_2004/__4.html)
- [ASR A2.3 „Fluchtwege und Notausgänge“](https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A2-3)
- [ASR A1.3 „Sicherheits- und Gesundheitsschutzkennzeichnung“](https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A1-3)
- DIN ISO 23601:2021-11 „Sicherheitskennzeichnung – Flucht- und Rettungspläne“
- DIN EN ISO 7010 einschließlich der in Deutschland geltenden Änderungen
- [BGN-Praxishilfe zum Erstellen von Flucht- und Rettungsplänen](https://bgn-branchenwissen.de/organisation-des-arbeitsschutzes/organisation-im-unternehmen/flucht-und-rettungsplan-erstellen)

Die verwendeten Sicherheitszeichen stammen aus dem offiziellen [BGHM-Downloadbereich für Sicherheitszeichen](https://www.bghm.de/arbeitsschuetzer/praxishilfen/sicherheitszeichen).

Ergänzend wurden die fachlichen Übersichten von [BauNetz Wissen](https://www.baunetzwissen.de/brandschutz/fachwissen/organisatorischer-bs/flucht--und-rettungsplan-3188833) und [Feuerwehrplan-erstellen.de](https://feuerwehrplan-erstellen.de/flucht-und-rettungsplan.html) berücksichtigt. Bei Abweichungen sind die Rechtsvorschrift, die Technischen Regeln und die aktuelle Normfassung maßgebend.

## Rechtlicher Hinweis

Der digitale Norm-Check ist eine strukturierte Vollständigkeits- und Plausibilitätskontrolle. Er stellt keine Zertifizierung oder Konformitätsbescheinigung dar. Die örtliche Situation, das Brandschutzkonzept, die Gefährdungsbeurteilung, bauordnungsrechtliche Anforderungen und gegebenenfalls behördliche Vorgaben müssen vor Freigabe fachkundig geprüft werden.

## Veröffentlichung

Die GitHub-Actions-Datei `.github/workflows/pages.yml` testet die Prüflogik und veröffentlicht den Inhalt des Ordners `public` automatisch auf GitHub Pages.

Lokaler Start:

```bash
python3 -m http.server 8080 --directory public
```

Tests:

```bash
node tests/rules.test.js
```
