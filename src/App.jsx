import React, { useMemo, useState, useRef } from "react";

/**
 * Likert skála:
 * 1=egyáltalán nem igaz rám, 2=inkább nem igaz, 3=részben igaz, 4=inkább igaz, 5=teljesen igaz
 * Pontozás: nagyobb pont = nagyobb kockázat/nyomás.
 * Dimenziók: -A-, -B-, -C- (rejtve a kitöltőnek, csak belsőleg)
 * Zónák (összpont 8–40): 8–16 (citromsárga), 17–25 (narancs), 26–34 (zöld), 35–40 (piros)
 */

const ITEMS = [
  // -A- (1–8)
  { id: 1, dim: "A", text: "Gyakran vállalok több, nagy láthatóságú feladatot egyszerre, még ha ez túlterheltséghez vezet." },
  { id: 2, dim: "A", text: "Változáskor nagyon gyorsan váltok, még akkor is, ha ezzel a stabil végrehajtást kockáztatom." },
  { id: 3, dim: "A", text: "Hajlamos vagyok azonnali eredményt várni a visszajelzések után, ami feszültséget kelt a csapatban." },
  { id: 4, dim: "A", text: "Versenyhelyzetben erősen rákapcsolok, és ez gyakran szorongást vagy nyomást generál bennem." },
  { id: 5, dim: "A", text: "Új kihívásoknál inkább belevágok tervezés nélkül, ami később kapkodást okozhat." },
  { id: 6, dim: "A", text: "Ha elérjük a célt, azonnal magasabb mércét állítok, ami kimerüléshez is vezethet." },
  { id: 7, dim: "A", text: "Kommunikációs stílusomat gyakran erőteljesre állítom, ami ellenállást válthat ki másokból." },
  { id: 8, dim: "A", text: "Nyomás alatt az eredménykényszer miatt kevésbé figyelek a hosszú távú következményekre." },

  // -B- (9–16)
  { id: 9, dim: "B", text: "Gyakran addig tökéletesítek egy feladatot, hogy emiatt kicsúszok a határidőből." },
  { id: 10, dim: "B", text: "Fontos döntéseket többször elhalasztok, bízva benne, hogy magától tisztul a kép." },
  { id: 11, dim: "B", text: "Konfliktusveszély esetén inkább elkerülöm a megbeszélést, még ha ez hátráltat is." },
  { id: 12, dim: "B", text: "Nyomás alatt kapkodok, és emiatt ismétlődő hibákat vétek." },
  { id: 13, dim: "B", text: "Ha nincs „tökéletes” megoldás, késlekedem az elkezdéssel." },
  { id: 14, dim: "B", text: "Könnyen átcsúszom sürgős, de kevésbé fontos feladatokba a stratégiai munka helyett." },
  { id: 15, dim: "B", text: "Visszajelzés előtt ritkán vállalok határozott álláspontot, tartva a kritikától." },
  { id: 16, dim: "B", text: "Kudarc után hosszan tartóan visszaesik a teljesítményem és a motivációm." },

  // -C- (17–24)
  { id: 17, dim: "C", text: "Erősen hajt az egyéni teljesítmény és verseny, ami időnként feszültséget okoz csapatmunkában." },
  { id: 18, dim: "C", text: "Ha a munka nem szolgál észszerű közösségi/jó ügyet, erős belső ellenállást érzek." },
  { id: 19, dim: "C", text: "Magas autonómiát igényelek; ha ezt korlátozzák, frusztrálttá válok." },
  { id: 20, dim: "C", text: "Ha a szervezet gyakorlata nem tükrözi az értékeimet (pl. átláthatóság), az erősen nyomaszt." },
  { id: 21, dim: "C", text: "Változatos szerepekben szeretek mozogni; ha ellaposodik a feladatkör, gyorsan demotiválódom." },
  { id: 22, dim: "C", text: "Ha a napi feladatok nem illeszkednek a hosszú távú karriercéljaimhoz, jelentős stresszt érzek." },
  { id: 23, dim: "C", text: "Ha kevés teret kapok mások fejlesztésére/csapatszintű felelősségre, elégedetlenné válok." },
  { id: 24, dim: "C", text: "Érték-inkongruencia esetén erős késztetést érzek az azonnali változtatásra vagy váltásra." },
];

// Tartományok definíciói és színek
const BANDS = [
  { key: "band1", from: 8, to: 16, label: "Nem ösztönöz, közömbös.", color: "#F7EA00" }, // citromsárga
  { key: "band2", from: 17, to: 25, label: "Enyhén motivál.", color: "#FFA500" }, // narancs
  { key: "band3", from: 26, to: 34, label: "Erős ösztönzés, lelkesít.", color: "#2ECC71" }, // zöld
  { key: "band4", from: 35, to: 40, label: "Nyomást helyez rám, stresszel.", color: "#FF3B30" }, // piros
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

const Slider = ({ value, onChange }) => {
  return (
    <div className="slider">
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value ?? 3}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Likert skála csúszka 1–5"
      />
      <div className="ticks">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
    </div>
  );
};

const BarWithBands = ({ label, score }) => {
  const percent = scalePercent(score);
  const currentBand = bandFor(score);
  return (
    <div className="barRow">
      <div className="barLabel">{label}</div>
      <div className="barWrap">
        <div className="barBg">
          <div className="seg seg1" />
          <div className="segDivider" />
          <div className="seg seg2" />
          <div className="segDivider" />
          <div className="seg seg3" />
          <div className="segDivider" />
          <div className="seg seg4" />
        </div>
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
  );
};

export default function VezetoiPotencialApp() {
  const shuffledItems = useMemo(() => shuffle(ITEMS), []);
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(shuffledItems.map(q => [q.id, 3]))
  );
  const [evaluated, setEvaluated] = useState(null);
  const printRef = useRef(null);

  const handleChange = (id, val) => {
    setAnswers(prev => ({ ...prev, [id]: val }));
  };

  const compute = () => {
    const sumA = ITEMS.filter(x => x.dim === "A").reduce((acc, x) => acc + (answers[x.id] ?? 3), 0);
    const sumB = ITEMS.filter(x => x.dim === "B").reduce((acc, x) => acc + (answers[x.id] ?? 3), 0);
    const sumC = ITEMS.filter(x => x.dim === "C").reduce((acc, x) => acc + (answers[x.id] ?? 3), 0);
    setEvaluated({ A: sumA, B: sumB, C: sumC });
    setTimeout(() => {
      document.getElementById("resultSection")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="app" ref={printRef}>
      <div className="container">
        <p className="instructions">
          Kérjük, minden állítást értékeljen az 1–5 skálán! 1=egyáltalán nem igaz rám, 2=inkább nem igaz,
          3=részben igaz, 4=inkább igaz, 5=teljesen igaz.
        </p>

        <div className="questions">
          {shuffledItems.map((q, idx) => (
            <div className="question" key={q.id}>
              <div className="qIndex">{idx + 1}.</div>
              <div className="qText">{q.text}</div>
              <div className="qInput">
                <Slider
                  value={answers[q.id]}
                  onChange={(v) => handleChange(q.id, v)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="actions no-print">
          <button className="btn primary" onClick={compute}>Kiértékelés</button>
          <button className="btn ghost" onClick={handlePrint}>Mentés PDF-be</button>
        </div>

        {evaluated && (
          <div id="resultSection" className="results">
            <div className="explain">
              Magasabb pont = nagyobb kockázat/nyomás. Zónák: 8–16 (citromsárga), 17–25 (narancs),
              26–34 (zöld), 35–40 (piros). A függőleges jelölő az összpont helyét mutatja.
            </div>

            <div className="bars">
              <BarWithBands label="-A-" score={evaluated.A} />
              <BarWithBands label="-B-" score={evaluated.B} />
              <BarWithBands label="-C-" score={evaluated.C} />
            </div>

            <div className="legend">
              {BANDS.map(b => (
                <div className="legendItem" key={b.key}>
                  <span className="dot" style={{ background: b.color }} />
                  <span>{b.from}–{b.to}: {b.label}</span>
                </div>
              ))}
            </div>

            <div className="actions no-print">
              <button className="btn primary" onClick={handlePrint}>Mentés PDF-be</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        :root {
          --bg: #ffffff;
          --text: #111;
          --muted: #555;
          --line: #d8d8d8;
          --brand: #111;
          --accent: #2e7d32;
        }
        * { box-sizing: border-box; }
        html, body, #root { height: 100%; }
        body { margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
        .app { display: flex; justify-content: center; padding: 16px; }
        .container { width: 100%; max-width: 960px; }
        .instructions { font-size: 14px; color: var(--muted); margin: 0 0 12px 0; }

        .questions { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .question {
          display: grid;
          grid-template-columns: 32px 1fr;
          gap: 8px;
          padding: 12px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: #fafafa;
        }
        .qIndex { font-weight: 700; opacity: .8; }
        .qText { font-size: 15px; line-height: 1.35; }
        .qInput { grid-column: 1 / -1; margin-top: 8px; }

        .slider input[type="range"] {
          width: 100%;
          appearance: none;
          height: 32px;
          background: linear-gradient(90deg, #eee, #e2e2e2);
          border-radius: 16px;
          outline: none;
          padding: 0;
          margin: 0;
        }
        .slider input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 28px; height: 28px; border-radius: 50%;
          background: #111; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25);
          margin-top: 2px;
        }
        .slider input[type="range"]::-moz-range-thumb {
          width: 28px; height: 28px; border-radius: 50%;
          background: #111; border: 2px solid #fff;
        }
        .slider .ticks {
          display: flex; justify-content: space-between; margin-top: 4px; font-size: 12px; color: var(--muted);
        }

        .actions { display: flex; gap: 8px; margin: 16px 0; }
        .btn {
          padding: 10px 14px; border-radius: 10px; font-weight: 600; cursor: pointer; border: 1px solid #0000;
        }
        .btn.primary { background: #111; color: #fff; }
        .btn.ghost { background: #fff; color: #111; border: 1px solid var(--line); }

        .results { margin-top: 12px; }
        .explain { font-size: 13px; color: var(--muted); margin-bottom: 12px; }

        .bars { display: grid; grid-template-columns: 1fr; gap: 12px; }

        .barRow {
          display: grid;
          grid-template-columns: 60px 1fr 160px;
          gap: 12px;
          align-items: center;
        }
        .barLabel { font-weight: 700; text-align: right; }
        .barWrap {
          position: relative;
          height: 40px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--line);
        }
        .barBg {
          position: absolute; inset: 0;
          display: grid;
          grid-template-columns: 20% 2px 22.5% 2px 25% 2px 32.5%;
        }
        .seg { height: 100%; }
        .seg1 { background: linear-gradient(90deg, #fff9a6, #F7EA00); }
        .seg2 { background: linear-gradient(90deg, #ffd28a, #FFA500); }
        .seg3 { background: linear-gradient(90deg, #b3f1c8, #2ECC71); }
        .seg4 { background: linear-gradient(90deg, #ff9a9a, #FF3B30); }
        .segDivider { background: #bdbdbd; }

        .marker {
          position: absolute; top: 0; bottom: 0; width: 2px; background: #333; transform: translateX(-1px);
        }

        .scaleNums {
          position: absolute; left: 0; right: 0; bottom: 2px;
          display: grid; grid-template-columns: 20% 22.5% 25% 32.5%;
          font-size: 11px; color: #222;
        }
        .scaleNums .snum { position: relative; }
        .scaleNums .s8  { left: 2px; }
        .scaleNums .s16 { left: calc(20% - 10px); }
        .scaleNums .s25 { left: calc(20% + 22.5% - 10px); }
        .scaleNums .s34 { left: calc(20% + 22.5% + 25% - 10px); }
        .scaleNums .s40 { position: absolute; right: 4px; bottom: -2px; }

        .barValue { font-size: 12px; color: #222; }
        .barValue .score { font-weight: 700; }
        .barValue .band { color: var(--muted); }

        .barWrap::after {
          content: '40';
          position: absolute; right: 4px; bottom: 2px; font-size: 11px; color: #222;
        }
        .barWrap::before {
          content: '8';
          position: absolute; left: 4px; bottom: 2px; font-size: 11px; color: #222;
        }

        .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
        .legendItem { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
        .legendItem .dot { width: 14px; height: 14px; border-radius: 4px; border: 1px solid #999; }

        @media (max-width: 640px) {
          .question { padding: 10px; }
          .qText { font-size: 14.5px; }
          .barRow { grid-template-columns: 40px 1fr; }
          .barValue { grid-column: 1 / -1; display: flex; gap: 12px; margin-top: 6px; }
          .barLabel { text-align: left; }
          .actions { position: sticky; bottom: 8px; background: #fff; padding: 8px 0; }
          .btn { flex: 1; }
        }

        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          .question { break-inside: avoid; }
          .barRow { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
