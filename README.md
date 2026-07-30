# Flucht- und Rettungsplan – webbasierter Ersteller

> **Sprache:** Die Dokumentation und sämtliche sichtbaren Texte der Anwendung sind ausschließlich auf Deutsch verfasst.

Diese Anwendung ist ein browserbasierter Ersteller für Flucht- und Rettungspläne. Sie kann über GitHub und Cloudflare Pages veröffentlicht werden und nutzt Cloudflare Workers AI für optionale KI-Funktionen. Eine lokale Installation für die Anwendung ist nicht erforderlich.

## Funktionen

- Grundrisse als SVG, PNG oder JPEG laden und darstellen
- Sicherheitszeichen mit ISO-7010-Kennung auf dem Plan platzieren
- Nordpfeil, Standortmarkierung „Sie sind hier“ und Legende darstellen
- KI-gestützte Vorschläge für Anordnung und Verhaltenstexte erzeugen
- Angaben zu Unternehmen, Gebäude, Etage, Revision, Verantwortlichen und fachkundiger Freigabe erfassen
- Fluchtwege mit Richtungspfeilen einzeichnen
- Abschließende Vor-Ort- und Fachkundigen-Prüfliste bearbeiten
- Formaler Plausibilitätscheck mit Bezug auf ArbStättV, ASR A2.3, ASR A1.3, DIN ISO 23601 und DIN EN ISO 7010
- Pläne als SVG, PNG oder PDF ausgeben

## Schnellstart

1. Ein neues GitHub-Projekt anlegen und die Dateien dieses Projekts hinzufügen.
2. Unter **Settings → Pages → Build and deployment → Source** die Einstellung **GitHub Actions** auswählen.
3. Den Arbeitsablauf **„Anwendung auf GitHub Pages veröffentlichen“** unter **Actions** starten oder eine Änderung in den Hauptzweig übertragen.
4. Nach erfolgreicher Veröffentlichung die unter **Settings → Pages** angezeigte Adresse öffnen.

Der Veröffentlichungsablauf stellt ausschließlich den Inhalt des Verzeichnisses `public` bereit. Dadurch wird `public/index.html` an der Startadresse geladen und nicht die Projektbeschreibung aus `README.md` angezeigt.

Für eine ältere, zweigbasierte GitHub-Pages-Konfiguration enthält das Stammverzeichnis zusätzlich eine Weiterleitung nach `public/`. Empfohlen bleibt die Veröffentlichung über den mitgelieferten GitHub-Actions-Arbeitsablauf.

### Cloudflare-Funktionen

Die reine GitHub-Pages-Veröffentlichung stellt nur die browserseitige Anwendung bereit. Serverseitige Funktionen unter `functions/api` – insbesondere zentrale Entwurfsspeicherung, KI-Unterstützung und serverseitige PDF-Erzeugung – benötigen weiterhin eine Cloudflare-Pages-Bereitstellung mit den im Projekt beschriebenen Bindungen. Die lokale automatische Sicherung, das Zeichnen sowie SVG-, PNG- und Browser-PDF-Ausgabe funktionieren ohne diese Serverfunktionen.

## Regelwerke und Gestaltung

- Die Gestaltung orientiert sich an DIN ISO 23601: weißer Hintergrund, eindeutige Orientierung, Legende, Standortmarkierung und Verhaltensregeln.
- Sicherheitszeichen werden anhand ihrer DIN-EN-ISO-7010-Kennungen den Kategorien E, F, W und M zugeordnet.
- Die mitgelieferten Symbole sind Platzhalter. Für die Veröffentlichung sind freigegebene Vektorgrafiken aus einer ordnungsgemäß lizenzierten Quelle zu verwenden.

### Informationsquellen

- [BGN: Flucht- und Rettungsplan erstellen](https://bgn-branchenwissen.de/organisation-des-arbeitsschutzes/organisation-im-unternehmen/flucht-und-rettungsplan-erstellen)
- [Baunetz Wissen: Flucht- und Rettungsplan](https://www.baunetzwissen.de/brandschutz/fachwissen/organisatorischer-bs/flucht--und-rettungsplan-3188833)
- [Feuerwehrplan erstellen: Flucht- und Rettungsplan](https://feuerwehrplan-erstellen.de/flucht-und-rettungsplan.html)

## Wichtiger Hinweis

Die automatische Normprüfung ist ausschließlich eine formale Plausibilitätsprüfung und keine Konformitätsbescheinigung. Der endgültige Plan muss unter Berücksichtigung der aktuellen Gefährdungsbeurteilung, des tatsächlichen Gebäudezustands, der landesrechtlichen und örtlichen Vorgaben sowie der Anforderungen zuständiger Behörden vor Ort durch eine fachkundige Person geprüft und freigegeben werden.
