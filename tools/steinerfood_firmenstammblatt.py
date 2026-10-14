# -*- coding: utf-8 -*-
import os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT, LOGO = sys.argv[1], sys.argv[2]
ORANGE = HexColor("#f28600"); GREY = HexColor("#555555"); LIGHT = HexColor("#fff4e6"); LINE = HexColor("#bbbbbb"); PALE = HexColor("#f7f7f7")
STAND = "14.10.2026"

for r,b in [("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf","/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
            ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")]:
    if os.path.exists(r) and os.path.exists(b):
        pdfmetrics.registerFont(TTFont("Body", r)); pdfmetrics.registerFont(TTFont("BodyB", b)); break
F, FB = "Helvetica", "Helvetica-Bold"
W, H = A4
ML, MR, MT, MB = 15*mm, 15*mm, 14*mm, 16*mm
CW = W-ML-MR; LABEL_W = 62*mm

c = canvas.Canvas(OUT, pagesize=A4, pageCompression=1)
c.setTitle("STEINERfood GmbH – Firmenstammblatt"); c.setAuthor("STEINERfood GmbH")
form = c.acroForm; page=[1]; y=[H-MT]; fid=[0]

def wrap(text, font, size, maxw):
    out=[]
    for para in text.split("\n"):
        words=para.split(); cur=""
        for w in words:
            t=(cur+" "+w).strip()
            if pdfmetrics.stringWidth(t, font, size) <= maxw or not cur: cur=t
            else: out.append(cur); cur=w
        out.append(cur)
    return out

def header():
    c.setFillColor(black)
    for i,l in enumerate(["STEINERfood GmbH","Neustift 6","2224 Sulz im Weinviertel","Österreich"]):
        c.setFont(FB if i==0 else F, 9.5); c.drawString(ML, H-MT-9-i*12, l)
    lw=44*mm; lh=lw*340/888
    c.drawImage(LOGO, W-MR-lw, H-MT-lh+2, width=lw, height=lh, mask=None)
    y[0]=H-MT-lh-8*mm

def footer():
    c.setFont(F, 8); c.setFillColor(GREY)
    c.drawString(ML, 9*mm, "STEINERfood GmbH · Neustift 6 · 2224 Sulz im Weinviertel · FN 525885 k · UID ATU75165606")
    c.drawRightString(W-MR, 9*mm, "Firmenstammblatt · Seite %d" % page[0])
    c.setFillColor(black)

def newpage():
    footer(); c.showPage(); page[0]+=1; header()

def need(h):
    if y[0]-h < MB+4*mm: newpage()

def title_bar(text, sub=None):
    need(18*mm)
    c.setFillColor(ORANGE); c.rect(ML, y[0]-10*mm, CW, 10*mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont(FB, 13); c.drawString(ML+4*mm, y[0]-6.8*mm, text)
    y[0]-=10*mm
    if sub:
        for l in wrap(sub, F, 9, CW):
            y[0]-=4.6*mm; c.setFillColor(GREY); c.setFont(F, 9); c.drawString(ML, y[0], l)
        c.setFillColor(black)
    y[0]-=4*mm

def section(num, text):
    need(30*mm); y[0]-=2*mm
    c.setFillColor(ORANGE); c.rect(ML, y[0]-7*mm, CW, 7*mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont(FB, 10.5); c.drawString(ML+3*mm, y[0]-4.9*mm, "%s  %s" % (num, text))
    c.setFillColor(black); y[0]-=8.5*mm

def row(label, value=None, lines=1, note=None):
    """value=str -> static; value=None -> fillable field."""
    ll = wrap(label, F, 9, LABEL_W-4*mm)
    vx = ML+LABEL_W; vw = CW-LABEL_W
    if value is not None:
        vl = wrap(value, F, 9, vw-4*mm)
        rh = max(4.6*mm*len(ll), 4.6*mm*len(vl)) + 3.2*mm
    else:
        vl = []; rh = max(7.2*mm*lines, 4.6*mm*len(ll)+3*mm) + 1.2*mm
    need(rh)
    c.setFont(F, 9); c.setFillColor(black)
    for i,t in enumerate(ll): c.drawString(ML+1*mm, y[0]-4.6*mm-i*4.6*mm, t)
    if value is not None:
        c.setFillColor(PALE); c.rect(vx, y[0]-rh+0.8*mm, vw, rh-1.6*mm, stroke=0, fill=1)
        c.setFillColor(black); c.setFont(FB if note=="bold" else F, 9)
        for i,t in enumerate(vl): c.drawString(vx+2*mm, y[0]-4.6*mm-i*4.6*mm, t)
    else:
        fid[0]+=1
        form.textfield(name="f%02d"%fid[0], tooltip=label, x=vx, y=y[0]-rh+0.8*mm, width=vw, height=rh-1.6*mm,
                       borderStyle="solid", borderWidth=0.5, borderColor=LINE, fillColor=LIGHT, textColor=black,
                       fontName="Helvetica", fontSize=9, fieldFlags=("multiline" if lines>1 else ""), forceBorder=True)
    y[0]-=rh
    c.setStrokeColor(LINE); c.setLineWidth(0.3); c.line(ML, y[0], W-MR, y[0])

def note(text):
    ll = wrap(text, F, 8, CW-2*mm)
    need(4*mm*len(ll)+3*mm); c.setFont(F, 8); c.setFillColor(GREY)
    for i,t in enumerate(ll): c.drawString(ML+1*mm, y[0]-4*mm-i*4*mm, t)
    c.setFillColor(black); y[0]-=4*mm*len(ll)+2.5*mm

header()
title_bar("Firmenstammblatt – Unternehmensdaten STEINERfood GmbH",
          "Zur schnellen Weitergabe an neue Partner, Lieferanten, Logistiker und Behörden (Onboarding, Lieferantenanlage, Kreditorenstammdaten). "
          "Grau hinterlegte Angaben sind öffentlich belegt (Firmenbuch, Impressum, WKO). Orange Felder sind nicht öffentlich und werden intern ergänzt.")

section("1", "Unternehmen und Register")
row("Firmenwortlaut", "STEINERfood GmbH", note="bold")
row("Marke / Produkte", "STEINER's – Low-Carb- und High-Protein-Lebensmittel (Brot, Brötchen, Pasta, Müsli, Snacks)")
row("Rechtsform", "Gesellschaft mit beschränkter Haftung (GmbH), Österreich")
row("Firmensitz / Geschäftsanschrift", "Neustift 6 (ehemals Obersulz 82), 2224 Sulz im Weinviertel, Niederösterreich, Österreich")
row("Firmenbuchnummer", "FN 525885 k")
row("Firmenbuchgericht", "Landesgericht Korneuburg")
row("Eingetragen seit", "11.01.2020 (Adressänderung auf Neustift 6 eingetragen 03.01.2026)")
row("Stammkapital", "EUR 35.000,00 (laut Firmenbuch)")
row("UID-Nummer (USt-IdNr.)", "ATU75165606")
row("Steuernummer (Finanzamt Österreich)")
row("Unternehmensgegenstand", "Entwicklung, Vermarktung und Vertrieb von Lebensmitteln, Schwerpunkt Low-Carb / High-Protein; Vertrieb über Handelspartner (LEH, Fachhandel, Gastronomie) und eigenen Online-Shop")
row("Gewerbeberechtigung", "Handelsgewerbe: Einzelhandel mit Lebensmitteln, Großhandel mit Lebensmitteln (freies Gewerbe, GewO 1994)")
row("Gewerberechtliche Geschäftsführerin", "Inge Monika Steiner")
row("Gewerbebehörde / Aufsicht", "Bezirkshauptmannschaft Gänserndorf")
row("Kammermitgliedschaft", "Wirtschaftskammer Niederösterreich, Sparte Handel, Landesgremium Lebensmittelhandel")
row("Branche (ÖNACE)", "47.11 Einzelhandel mit Waren verschiedener Art, Hauptrichtung Nahrungs- und Genussmittel (Klassifikation laut Creditreform); Großhandel laut Gewerbeberechtigung")

section("2", "Geschäftsführung und Eigentümer")
row("Geschäftsführung", "Inge Monika Steiner – Geschäftsführerin, selbständig vertretungsbefugt seit 11.01.2020\nMatthias Steiner – Geschäftsführer, selbständig vertretungsbefugt seit 11.01.2020")
row("Gesellschafter", "Inge Monika Steiner 51 % (Stammeinlage EUR 17.850,00)\nMatthias Steiner 49 % (Stammeinlage EUR 17.150,00)")
row("Gründer / Markenhintergrund", "Gegründet 2020 von Matthias Steiner (Olympiasieger Gewichtheben 2008) und Inge Steiner (Journalistin und Moderatorin)")

section("3", "Kontakt und Ansprechpartner")
row("Telefon zentral", "+43 660 354 9954")
row("E-Mail allgemein / Kundenservice", "service@steinerfood.com")
row("Website / Online-Shop", "www.steinerfood.com · www.steiners.shop")
row("Vertrieb / Handelspartner", "Manuela Behr, Sales Manager\nm.behr@steinerfood.com · Mobil +43 660 381 3102", note="bold")
row("Vertriebsteam", "Inga Bruns · i.bruns@steinerfood.com")
row("Buchhaltung / Rechnungswesen (Name, E-Mail, Telefon)")
row("E-Mail für Eingangsrechnungen")
row("Geschäftsführung (Kontakt)")

section("4", "Standorte und Logistik")
row("Standort Österreich (Sitz, Verwaltung, Vertrieb)", "STEINERfood GmbH, Neustift 6, 2224 Sulz im Weinviertel, Österreich")
row("Standort Deutschland (Retouren- / Logistikadresse)", "Johann Mader GmbH, c/o STEINERfood, Faunstraße 6, 91522 Ansbach, Deutschland (Logistikpartner laut Widerrufsbelehrung steiners.shop – keine eigene Niederlassung)")
row("Lieferländer Online-Shop", "Österreich, Deutschland, Luxemburg, Belgien, Niederlande")
row("Warenannahme / Anlieferzeiten / Avisierung")
row("GLN (GS1 Global Location Number)")
row("EORI-Nummer (Zoll)")
row("Verpackungslizenzierung Österreich (ARA / Lizenznummer)")
row("Verpackungsregister Deutschland (LUCID-Nr.)")
row("Lieferanten- / Kreditorennummer bei Ihnen")

section("5", "Bankverbindung und Zahlung")
row("Bank")
row("IBAN")
row("BIC")
row("Kontoinhaber", "STEINERfood GmbH")
row("Rechnungsadresse", "STEINERfood GmbH, Neustift 6, 2224 Sulz im Weinviertel, Österreich (identisch mit Firmensitz)")
row("Zahlungsziel / Konditionen laut Vereinbarung")

section("6", "Nachweise und Quellen")
row("Impressum", "steinerfood.com/impressum · steiners.shop/policies/legal-notice")
row("Firmenbuch-Auszug", "Firmenbuch der Republik Österreich (justizonline.gv.at), FN 525885 k")
row("WKO Firmen A-Z", "firmen.wko.at – Eintrag STEINERfood GmbH, Niederösterreich")
row("Datenschutz", "steinerfood.com/datenschutz · Datenschutzanfragen an service@steinerfood.com")
row("Stand / erstellt", "%s · erstellt für Manuela Behr, Vertrieb STEINERfood GmbH" % STAND)
y[0]-=2*mm
note("Quellen: Impressum steinerfood.com und steiners.shop, Firmenbuch (FN 525885 k, LG Korneuburg), WKO Firmen A-Z, Unternehmensregister-Auszüge (Stand %s). "
     "Nicht öffentliche Angaben (Steuernummer, Bankverbindung, EORI, GLN, Verpackungslizenzen, Buchhaltungskontakt) bitte vor Weitergabe intern ergänzen und das Blatt als PDF speichern." % STAND)
footer(); c.save(); print("ok pages", page[0])
