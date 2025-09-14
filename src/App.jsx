import React, { useMemo, useState, useRef, useEffect } from "react";
import QRCode from "qrcode";
// Firebase imports removed for static deployment

/**
 * Likert skála:
 * 1=egyáltalán nem igaz rám, 2=inkább nem igaz, 3=részben igaz, 4=inkább igaz, 5=teljesen igaz
 * Pontozás: nagyobb pont = nagyobb kockázat/nyomás.
 * Dimenziók: -A-, -B-, -C- (rejtve a kitöltőnek, csak belsőleg)
 * Zónák (összpont 8–40): 8–16 (citromsárga), 17–25 (narancs), 26–34 (zöld), 35–40 (piros)
 */

const ITEMS = [
  // -A- (1–8) - Updated with better alignment
  { id: 2, dim: "A", text: "Változáskor nagyon gyorsan váltok, még akkor is, ha ezzel a stabil végrehajtást kockáztatom." },
  { id: 5, dim: "A", text: "Új kihívásoknál inkább belevágok tervezés nélkül, ami később kapkodást okozhat." },
  { id: 6, dim: "A", text: "Ha elérjük a célt, azonnal magasabb mércét állítok, ami kimerüléshez is vezethet." },
  { id: 8, dim: "A", text: "Nyomás alatt az eredménykényszer miatt kevésbé figyelek a hosszú távú következményekre." },
  { id: 17, dim: "A", text: "Erősen hajt az egyéni teljesítmény és verseny, ami időnként feszültséget okoz csapatmunkában." },
  { id: 19, dim: "A", text: "Magas autonómiát igényelek; ha ezt korlátozzák, frusztrálttá válok." },
  { id: 21, dim: "A", text: "Változatos szerepekben szeretek mozogni; ha ellaposodik a feladatkör, gyorsan demotiválódom." },
  { id: 25, dim: "A", text: "Ambiciózus célokat tűzök ki magam elé, még ha ez túlzott nyomást helyez rám." },

  // -B- (9–16) - Updated with moved questions
  { id: 1, dim: "B", text: "Gyakran vállalok több, nagy láthatóságú feladatot egyszerre, még ha ez túlterheltséghez vezet." },
  { id: 3, dim: "B", text: "Hajlamos vagyok azonnali eredményt várni a visszajelzések után, ami feszültséget kelt a csapatban." },
  { id: 4, dim: "B", text: "Versenyhelyzetben erősen rákapcsolok, és ez gyakran szorongást vagy nyomást generál bennem." },
  { id: 9, dim: "B", text: "Gyakran addig tökéletesítek egy feladatot, hogy emiatt kicsúszok a határidőből." },
  { id: 10, dim: "B", text: "Fontos döntéseket többször elhalasztok, bízva benne, hogy magától tisztul a kép." },
  { id: 12, dim: "B", text: "Nyomás alatt kapkodok, és emiatt ismétlődő hibákat vétek." },
  { id: 14, dim: "B", text: "Könnyen átcsúszom sürgős, de kevésbé fontos feladatokba a stratégiai munka helyett." },
  { id: 16, dim: "B", text: "Kudarc után hosszan tartóan visszaesik a teljesítményem és a motivációm." },

  // -C- (17–24) - Updated with moved question and rebalanced
  { id: 7, dim: "C", text: "Kommunikációs stílusomat gyakran erőteljesre állítom, ami ellenállást válthat ki másokból." },
  { id: 11, dim: "C", text: "Konfliktusveszély esetén inkább elkerülöm a megbeszélést, még ha ez hátráltat is." },
  { id: 15, dim: "C", text: "Visszajelzés előtt ritkán vállalok határozott álláspontot, tartva a kritikától." },
  { id: 18, dim: "C", text: "Ha a munka nem szolgál észszerű közösségi/jó ügyet, erős belső ellenállást érzek." },
  { id: 20, dim: "C", text: "Ha a szervezet gyakorlata nem tükrözi az értékeimet (pl. átláthatóság), az erősen nyomaszt." },
  { id: 22, dim: "C", text: "Ha a napi feladatok nem illeszkednek a hosszú távú karriercéljaimhoz, jelentős stresszt érzek." },
  { id: 23, dim: "C", text: "Ha kevés teret kapok mások fejlesztésére/csapatszintű felelősségre, elégedetlenné válok." },
  { id: 24, dim: "C", text: "Érték-inkongruencia esetén erős késztetést érzek az azonnali változtatásra vagy váltásra." },
];

const A_TITLE = "Agilitás és ambíció";
const B_TITLE = "Kisiklási kockázatok, halogatási hajlandóság";
const C_TITLE = "Illeszkedés, értékrend, kultúra";

const A_DESC = "Az új helyzetekhez való gyors alkalmazkodás és erős teljesítményhajtóerő együttese, amely előmozdítja a cselekvést, de túlhasználat esetén, nyomást, kényszerteljesítést okozhat.";
const B_DESC = "Perfekcionizmus, impulzivitás, amelyek döntési késlekedést, fókuszvesztést és teljesítményingadozást idézhetnek elő.";
const C_DESC = "Normák, motiváció és viselkedési minták összhangja, együttműködés a szervezeti kultúrával, amely erősíti a elköteleződést, míg ütközés esetén feszültséget és demotivációt okozhat.";

// Tartományok definíciói és színek
const BANDS = [
  { key: "band1", from: 8, to: 16, label: "Nem ösztönöz, közömbös.", color: "#F7EA00" },
  { key: "band2", from: 17, to: 25, label: "Enyhén motivál.", color: "#FFA500" },
  { key: "band3", from: 26, to: 34, label: "Erős ösztönzés, lelkesít.", color: "#2ECC71" },
  { key: "band4", from: 35, to: 40, label: "Nyomást helyez rám, stresszel.", color: "#FF3B30" },
];

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function bandFor(score) {
  return BANDS.find(b => score >= b.from && score <= b.to) || null;
}

function scalePercent(score) {
  const clamped = Math.max(8, Math.min(40, score));
  return ((clamped - 8) / (40 - 8)) * 100;
}

const Slider = ({ value, onChange, isAnswered }) => {
  return (
    <div className={`slider ${isAnswered ? 'answered' : ''}`}>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value ?? 3}
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={(e) => {
          // Ha null és éppen a 3-ason kattintunk
          if (value === null) {
            onChange(3);
          }
        }}
        aria-label="Likert skála csúszka 1–5"
      />
    </div>
  );
};

const BarWithBands = ({ label, score, showLegend = false }) => {
  const percent = scalePercent(score);
  const currentBand = bandFor(score);
  return (
    <>
      <div className="barRow">
        <div className="barLabel">{label}</div>
        <div className="barWrap">
          <div className="barBg" />
          <div className="marker" style={{ left: `${percent}%` }} />
          <div className="scaleNums">
            <span className="snum s8">8</span>
            <span className="snum s16">16</span>
            <span className="snum s25">25</span>
            <span className="snum s34">34</span>
            <span className="snum s40">40</span>
          </div>
        </div>
        <div className="barValue">
          <div className="score">{score ?? "__"} pont</div>
          <div className="band">{currentBand ? currentBand.label : ""}</div>
        </div>
      </div>
      {showLegend && (
        <div className="barLegend">
          <div className="legend-item">
            <span className="legend-range">8-16</span>
            <span className="legend-label">Nem ösztönöz, közömbös</span>
          </div>
          <div className="legend-item">
            <span className="legend-range">17-25</span>
            <span className="legend-label">Enyhén motivál</span>
          </div>
          <div className="legend-item">
            <span className="legend-range">26-34</span>
            <span className="legend-label">Erős ösztönzés, lelkesít</span>
          </div>
          <div className="legend-item">
            <span className="legend-range">35-40</span>
            <span className="legend-label">Nyomást helyez rám, stresszel</span>
          </div>
        </div>
      )}
    </>
  );
};

export default function VezetoiPotencialApp() {
  const shuffledItems = useMemo(() => shuffle(ITEMS), []);
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(shuffledItems.map(q => [q.id, null]))
  );
  const [evaluated, setEvaluated] = useState(null);
  const printRef = useRef(null);
  const [userEmail, setUserEmail] = useState("");
  const [user, setUser] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [showQrCode, setShowQrCode] = useState(false);

  const handleChange = (id, val) => {
    setAnswers(prev => ({ ...prev, [id]: val }));
  };

  useEffect(() => {
    // Firebase removed - using static user for deployment
    setUser({ uid: 'static-user-' + Date.now() });
    // E-mail átvétele URL paraméterből (?email=...)
    const params = new URLSearchParams(window.location.search);
    const paramEmail = params.get("email");
    if (paramEmail) setUserEmail(paramEmail);
  }, []);

  const compute = () => {
    // Ellenőrizzük, hogy minden kérdés válaszolva van-e
    const unanswered = shuffledItems.filter(q => answers[q.id] === null);
    if (unanswered.length > 0) {
      alert(`Kérlek válaszolj minden kérdésre! Válaszolatlan kérdések száma: ${unanswered.length}`);
      return;
    }

    const sumA = ITEMS.filter(x => x.dim === "A").reduce((acc, x) => acc + answers[x.id], 0);
    const sumB = ITEMS.filter(x => x.dim === "B").reduce((acc, x) => acc + answers[x.id], 0);
    const sumC = ITEMS.filter(x => x.dim === "C").reduce((acc, x) => acc + answers[x.id], 0);
    setEvaluated({ A: sumA, B: sumB, C: sumC });
    setTimeout(() => {
      document.getElementById("resultSection")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  const handlePrint = () => {
    // Háttérmentés, majd nyomtatás
    handleSubmitResult().catch(() => {});
    setTimeout(() => window.print(), 50);
  };

  const handleSubmitResult = async () => {
    if (!user) return;
    if (!evaluated) {
      alert("Előbb értékeld ki az eredményt!");
      return;
    }
    // Firebase removed - results are only displayed locally
    console.log("Eredmény:", { email: userEmail || null, result: evaluated, timestamp: new Date().toISOString() });
    alert("Eredmény sikeresen kiértékelve! (Adatok csak lokálisan tárolva)");
  };

  const generateQrCode = async () => {
    try {
      // Generate QR code with fixed production URL for mobile access
      const targetUrl = "https://vezetoi-potencial.vistaverde.hu/";
      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#155724',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
      setShowQrCode(true);
    } catch (error) {
      console.error('QR kód generálása sikertelen:', error);
      alert('QR kód generálása sikertelen!');
    }
  };

  const closeQrCode = () => {
    setShowQrCode(false);
  };

  return (
    <div className="app" ref={printRef}>
      <div className="container">
        <h1 className="app-title">Vezetői Potenciál Teszt</h1>

        <div className="questions">
          {shuffledItems.map((q, idx) => (
            <div className="question" key={q.id}>
              <div className="qIndex">{idx + 1}.</div>
              <div className="qText">{q.text}</div>
              <div className="qInput">
                <div className="slider-labels">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
                <Slider
                  value={answers[q.id]}
                  onChange={(v) => handleChange(q.id, v)}
                  isAnswered={answers[q.id] !== null}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="actions no-print">
          <button className="btn primary" onClick={compute}>Kiértékelés</button>
          <button className="btn ghost" onClick={handlePrint}>Mentés PDF-be</button>
          <button className="btn ghost" onClick={generateQrCode}>QR kód mobilhoz</button>
        </div>

        {evaluated && (
          <div id="resultSection" className="results">
            <div className="bars">
              <BarWithBands label={A_TITLE} score={evaluated.A} />
              <BarWithBands label={B_TITLE} score={evaluated.B} />
              <BarWithBands label={C_TITLE} score={evaluated.C} showLegend={true} />
            </div>

            <div className="definitions">
              <div className="defItem">
                <div className="defTitle">{A_TITLE}</div>
                <div className="defText">{A_DESC}</div>
              </div>
              <div className="defItem">
                <div className="defTitle">{B_TITLE}</div>
                <div className="defText">{B_DESC}</div>
              </div>
              <div className="defItem">
                <div className="defTitle">{C_TITLE}</div>
                <div className="defText">{C_DESC}</div>
              </div>
            </div>

            <div className="actions no-print">
              <button className="btn primary" onClick={handlePrint}>Mentés PDF-be (háttérben mentés)</button>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrCode && (
        <div className="qr-modal no-print" onClick={closeQrCode}>
          <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h3>QR kód mobil kitöltéshez</h3>
              <button className="qr-close-btn" onClick={closeQrCode}>&times;</button>
            </div>
            <div className="qr-modal-body">
              <p>Olvasd be ezt a QR kódot telefonoddal a teszt mobil kitöltéséhez:</p>
              {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR Code" className="qr-code-image" />}
              <p className="qr-note">A QR kód ugyanezt az oldalt nyitja meg mobilon optimalizált nézetnél.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
