import { useState } from "react";

const ROWS = [
  { item: "テレビ", year: "年式問わず", status: "3B", dest: "バッタヤ", note: "リモコンの欠品を記載", warn: false },
  { item: "洗濯機・ドラム式", year: "〜2017", status: "3B", dest: "輸出", note: "", warn: false },
  { item: "洗濯機・ドラム式", year: "2018〜", status: "3B", dest: "バッタヤ", note: "", warn: false },
  { item: "洗濯機・ドラム式", year: "年式問わず", status: "3J", dest: "輸出", note: "明らかな破損がある場合のみ", warn: true },
  { item: "冷蔵庫（2〜5ドア）", year: "〜2017", status: "3B", dest: "輸出", note: "", warn: false },
  { item: "冷蔵庫（2〜5ドア）", year: "2018〜", status: "3B", dest: "バッタヤ", note: "", warn: false },
  { item: "冷蔵庫（2〜5ドア）", year: "年式問わず", status: "3J", dest: "輸出", note: "明らかな破損・ひどいにおいがある場合のみ", warn: true },
  { item: "冷蔵庫（6ドア）", year: "〜2013", status: "3B", dest: "輸出", note: "", warn: false },
  { item: "冷蔵庫（6ドア）", year: "2014〜", status: "3B", dest: "バッタヤ", note: "", warn: false },
  { item: "冷蔵庫（6ドア）", year: "年式問わず", status: "3J", dest: "輸出", note: "明らかな破損・ひどいにおいがある場合のみ", warn: true },
  { item: "エアコン", year: "〜2017", status: "3B", dest: "輸出", note: "", warn: false },
  { item: "エアコン", year: "2018〜", status: "3B", dest: "バッタヤ", note: "", warn: false },
  { item: "エアコン", year: "年式問わず", status: "3J", dest: "バッタヤ", note: "明らかな破損がある場合のみ", warn: true },
  { item: "その他家電", year: "年式問わず", status: "3B", dest: "バッタヤ", note: "", warn: false },
];

// 品目ごとに交互の背景色
const ITEM_BG = ["#FFFFFF", "#F9FAFB"];
function getItemBg(item: string, warn: boolean): string {
  if (warn) return "var(--warn-bg)";
  const items = [...new Set(ROWS.map((r) => r.item))];
  return ITEM_BG[items.indexOf(item) % 2];
}

export default function WorkGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="work-guide card">
      <button className="work-guide-toggle" onClick={() => setOpen(!open)}>
        <span>{open ? "▼" : "▶"}</span>
        撮影作業手順ガイド
      </button>
      {open && (
        <div className="work-guide-body">
          <table>
            <thead>
              <tr>
                <th>品目</th>
                <th>年式</th>
                <th>状態</th>
                <th>販売候補</th>
                <th>備考</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={i}
                  className={row.warn ? "row-warn" : ""}
                  style={{ backgroundColor: getItemBg(row.item, row.warn) }}
                >
                  <td>{row.item}</td>
                  <td>{row.year}</td>
                  <td><strong>{row.status}</strong></td>
                  <td>{row.dest}</td>
                  <td style={{ fontSize: "0.8rem", color: "#6B7280" }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
