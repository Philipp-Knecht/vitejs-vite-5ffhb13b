import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Clock, Flame, Beef, Trash2, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import {
  fetchEntriesForDay,
  fetchHistory,
  addEntry as dbAddEntry,
  deleteEntry as dbDeleteEntry,
  todayDate,
} from './supabase';

const FOOD_DB = {
  lunch_protein: {
    label: 'Mittag · Protein',
    items: [
      { name: 'Hähnchenbrust 200g', kcal: 220, protein: 46 },
      { name: 'Putenbrust-Aufschnitt 150g', kcal: 150, protein: 32 },
      { name: 'Thunfisch in Wasser 1 Dose', kcal: 110, protein: 26 },
      { name: 'Lachs geräuchert 150g', kcal: 270, protein: 30 },
      { name: 'Harzer Käse 1 Packung', kcal: 130, protein: 30 },
      { name: 'Hüttenkäse 200g', kcal: 180, protein: 26 },
    ],
  },
  lunch_sides: {
    label: 'Mittag · Beilage',
    items: [
      { name: 'Vollkornreis Beutel 250g', kcal: 280, protein: 7 },
      { name: 'Kartoffeln 300g', kcal: 210, protein: 6 },
      { name: 'Vollkornbrot 2 Scheiben', kcal: 200, protein: 8 },
      { name: 'Süßkartoffel 250g', kcal: 220, protein: 4 },
    ],
  },
  snack_protein: {
    label: 'Snack · Protein',
    items: [
      { name: 'Magerquark 250g', kcal: 170, protein: 33 },
      { name: 'Skyr Becher 450g', kcal: 280, protein: 50 },
      { name: 'Ehrmann High Protein Pudding', kcal: 140, protein: 20 },
      { name: 'Harzer Käse 100g', kcal: 130, protein: 30 },
      { name: '2 hartgekochte Eier', kcal: 150, protein: 13 },
      { name: 'Beef Jerky 50g', kcal: 140, protein: 25 },
      { name: 'Hähnchen-Aufschnitt 100g', kcal: 100, protein: 22 },
    ],
  },
  snack_produce: {
    label: 'Obst & Gemüse',
    items: [
      { name: 'Apfel', kcal: 80, protein: 0 },
      { name: 'Banane', kcal: 100, protein: 1 },
      { name: 'Beeren 150g', kcal: 50, protein: 1 },
      { name: 'Erdbeeren 200g', kcal: 65, protein: 1 },
      { name: 'Gurke ganz', kcal: 30, protein: 2 },
      { name: 'Cherrytomaten 200g', kcal: 35, protein: 2 },
      { name: 'Paprika ganz', kcal: 35, protein: 2 },
      { name: 'Wassermelone 300g', kcal: 90, protein: 2 },
    ],
  },
  dinner_protein: {
    label: 'Abend · Protein',
    items: [
      { name: 'Lachsfilet 180g', kcal: 360, protein: 38 },
      { name: 'Hähnchenbrust 250g', kcal: 275, protein: 58 },
      { name: '4 Eier Rührei', kcal: 310, protein: 25 },
      { name: 'Hackfleisch mager 200g', kcal: 300, protein: 42 },
      { name: 'Tofu natur 200g', kcal: 150, protein: 30 },
      { name: 'Magerquark 500g (Pfannkuchen)', kcal: 335, protein: 65 },
    ],
  },
  dinner_veg: {
    label: 'Abend · Gemüse',
    items: [
      { name: 'Brokkoli 300g', kcal: 100, protein: 8 },
      { name: 'Zucchini 300g', kcal: 50, protein: 5 },
      { name: 'Paprika 300g', kcal: 95, protein: 3 },
      { name: 'Großer Salat', kcal: 30, protein: 2 },
      { name: 'Spinat 200g', kcal: 45, protein: 6 },
    ],
  },
  dessert: {
    label: 'Nachtisch',
    items: [
      { name: 'Magerquark 200g + Beeren', kcal: 180, protein: 28 },
      { name: 'Skyr 150g + Erdbeeren', kcal: 110, protein: 17 },
      { name: 'Müller Froop High Protein', kcal: 140, protein: 20 },
      { name: 'Protein-Pudding Ehrmann', kcal: 140, protein: 20 },
      { name: 'Gefrorene Beeren + Quark "Eis"', kcal: 150, protein: 20 },
      { name: 'Banane + 1 TL Zartbitter', kcal: 130, protein: 2 },
    ],
  },
};

const KCAL_GOAL = 2500;
const PROTEIN_GOAL = 130;
const WINDOW_START = 12;
const WINDOW_END = 18;

function formatDate(dayStr) {
  const [y, m, d] = dayStr.split('-');
  return `${d}.${m}.${y}`;
}

function timeNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('lunch_protein');
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [todayEntries, historyData] = await Promise.all([
        fetchEntriesForDay(todayDate()),
        fetchHistory(todayDate()),
      ]);
      setEntries(todayEntries);
      setHistory(historyData);
      setError(null);
    } catch (e) {
      setError('Verbindung zur Datenbank fehlgeschlagen. Check deine Supabase Keys.');
      console.error(e);
    }
    setLoading(false);
  }

  function showToast(msg, isError = false) {
    setToast({ msg, error: isError });
    setTimeout(() => setToast(null), 2000);
  }

  async function handleAddEntry(item) {
    const newEntry = {
      name: item.name,
      kcal: item.kcal,
      protein: item.protein,
      time: timeNow(),
      day: todayDate(),
    };
    try {
      const saved = await dbAddEntry(newEntry);
      setEntries(prev => [...prev, saved]);
      showToast(`+${item.kcal} kcal · +${item.protein}g`);
    } catch (e) {
      showToast('Speichern fehlgeschlagen', true);
      console.error(e);
    }
  }

  async function handleRemoveEntry(id) {
    try {
      await dbDeleteEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      showToast('Löschen fehlgeschlagen', true);
      console.error(e);
    }
  }

  const totalKcal = useMemo(() => entries.reduce((s, e) => s + e.kcal, 0), [entries]);
  const totalProtein = useMemo(() => entries.reduce((s, e) => s + e.protein, 0), [entries]);
  const kcalRemaining = KCAL_GOAL - totalKcal;
  const proteinRemaining = PROTEIN_GOAL - totalProtein;

  const hour = now.getHours();
  const minute = now.getMinutes();
  const inWindow = hour >= WINDOW_START && hour < WINDOW_END;
  const minutesLeft = inWindow ? (WINDOW_END - hour) * 60 - minute : 0;
  const hoursLeft = Math.floor(minutesLeft / 60);
  const minsLeft = minutesLeft % 60;

  let windowStatus;
  if (inWindow) {
    windowStatus = `Fenster offen · noch ${hoursLeft}h ${minsLeft}min`;
  } else if (hour < WINDOW_START) {
    const h = WINDOW_START - hour - (minute > 0 ? 1 : 0);
    const m = minute > 0 ? 60 - minute : 0;
    windowStatus = `Fenster öffnet in ${h}h ${m}min`;
  } else {
    windowStatus = 'Fenster geschlossen bis morgen 12 Uhr';
  }

  const kcalPct = Math.min(100, (totalKcal / KCAL_GOAL) * 100);
  const proteinPct = Math.min(100, (totalProtein / PROTEIN_GOAL) * 100);
  const category = FOOD_DB[activeCategory];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9A95' }}>
        <div>Lade...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ color: '#FF6A6A', fontSize: '14px', marginBottom: '12px' }}>{error}</div>
          <button
            onClick={() => { setLoading(true); loadData(); }}
            style={{
              padding: '10px 20px',
              borderRadius: '100px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: '#F5F5F0',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Nochmal versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '120px', paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '24px 20px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6A6A65', fontWeight: 500 }}>
              {new Date().toLocaleDateString('de-DE', { weekday: 'long' })}
            </div>
            <h1 style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: '32px',
              fontWeight: 500,
              margin: '2px 0 0',
              letterSpacing: '-0.02em',
            }}>
              Heute
            </h1>
          </div>
          <div style={{
            fontFamily: 'Instrument Serif, serif',
            fontStyle: 'italic',
            fontSize: '22px',
            color: '#D4FF3F',
          }}>
            {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '100px',
          background: inWindow ? 'rgba(212, 255, 63, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${inWindow ? 'rgba(212, 255, 63, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
          marginTop: '12px',
          fontSize: '12px',
          color: inWindow ? '#D4FF3F' : '#9A9A95',
          fontWeight: 500,
        }}>
          <Clock size={12} />
          {windowStatus}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px' }}>
          <ProgressCard
            icon={<Flame size={16} />}
            label="Kalorien"
            value={totalKcal}
            goal={KCAL_GOAL}
            pct={kcalPct}
            remaining={kcalRemaining}
            unit="kcal"
            color="#D4FF3F"
          />
          <ProgressCard
            icon={<Beef size={16} />}
            label="Protein"
            value={totalProtein}
            goal={PROTEIN_GOAL}
            pct={proteinPct}
            remaining={proteinRemaining}
            unit="g"
            color="#FF9A3F"
          />
        </div>

        <div style={{ marginTop: '32px' }}>
          <div style={{
            fontFamily: 'Bricolage Grotesque, sans-serif',
            fontSize: '20px',
            fontWeight: 500,
            marginBottom: '12px',
            letterSpacing: '-0.01em',
          }}>
            Hinzufügen
          </div>

          <div
            className="no-scrollbar"
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px',
              marginBottom: '12px',
              marginLeft: '-20px',
              marginRight: '-20px',
              paddingLeft: '20px',
              paddingRight: '20px',
            }}
          >
            {Object.entries(FOOD_DB).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                style={{
                  flex: 'none',
                  padding: '8px 14px',
                  borderRadius: '100px',
                  border: `1px solid ${activeCategory === key ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                  background: activeCategory === key ? '#F5F5F0' : 'transparent',
                  color: activeCategory === key ? '#0A0B0D' : '#9A9A95',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {category.items.map((item, i) => (
              <button
                key={i}
                onClick={() => handleAddEntry(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: '#15161A',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: '#F5F5F0',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '2px' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: '#6A6A65' }}>
                    {item.kcal} kcal · {item.protein}g Protein
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(212, 255, 63, 0.1)',
                  color: '#D4FF3F',
                  flexShrink: 0,
                  marginLeft: '12px',
                }}>
                  <Plus size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: '20px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}>
              Heute gegessen
            </div>
            <div style={{ fontSize: '12px', color: '#6A6A65' }}>
              {entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'}
            </div>
          </div>

          {entries.length === 0 ? (
            <div style={{
              padding: '32px 16px',
              borderRadius: '14px',
              border: '1px dashed rgba(255,255,255,0.1)',
              textAlign: 'center',
              color: '#6A6A65',
              fontSize: '13px',
            }}>
              Noch nichts gegessen heute
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {entries.map(e => (
                <div
                  key={e.id}
                  className="slide-up"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: '#15161A',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{
                    fontFamily: 'Instrument Serif, serif',
                    fontStyle: 'italic',
                    fontSize: '14px',
                    color: '#6A6A65',
                    width: '42px',
                  }}>
                    {e.time}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6A6A65' }}>
                      {e.kcal} kcal · {e.protein}g
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveEntry(e.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#6A6A65',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '32px' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '14px',
              background: '#15161A',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#F5F5F0',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span>Verlauf (letzte 7 Tage)</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showHistory && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {history.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: '#6A6A65',
                  fontSize: '13px',
                }}>
                  Noch kein Verlauf
                </div>
              ) : (
                history.map(d => (
                  <div
                    key={d.day}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: '#111216',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#9A9A95' }}>{formatDate(d.day)}</div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                      <span style={{ color: '#D4FF3F' }}>{d.kcal} kcal</span>
                      <span style={{ color: '#FF9A3F' }}>{d.protein}g</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div style={{
          marginTop: '40px',
          padding: '16px',
          borderRadius: '14px',
          background: 'rgba(212, 255, 63, 0.04)',
          border: '1px solid rgba(212, 255, 63, 0.1)',
          fontSize: '12px',
          color: '#9A9A95',
          lineHeight: 1.6,
        }}>
          <div style={{ color: '#D4FF3F', fontWeight: 500, marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Ziele
          </div>
          2500 kcal · 130g Protein · Essens-Fenster 12–18 Uhr
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(32px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.error ? '#FF4444' : '#D4FF3F',
          color: '#0A0B0D',
          padding: '10px 18px',
          borderRadius: '100px',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'toastIn 0.3s ease-out',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          zIndex: 100,
        }}>
          {toast.error ? <X size={14} /> : <Check size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function ProgressCard({ icon, label, value, goal, pct, remaining, unit, color }) {
  const isOver = remaining < 0;
  return (
    <div style={{
      padding: '16px',
      borderRadius: '16px',
      background: '#15161A',
      border: '1px solid rgba(255,255,255,0.06)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: color, marginBottom: '8px' }}>
        {icon}
        <div style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '10px' }}>
        <div style={{
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontSize: '32px',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: '#F5F5F0',
          lineHeight: 1,
        }}>
          {value}
        </div>
        <div style={{ fontSize: '12px', color: '#6A6A65' }}>
          / {goal}{unit === 'g' ? 'g' : ''}
        </div>
      </div>

      <div style={{
        height: '4px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '100px',
        overflow: 'hidden',
        marginBottom: '8px',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: '100px',
          transition: 'width 0.4s ease-out',
        }} />
      </div>

      <div style={{
        fontSize: '11px',
        color: isOver ? '#FF6A6A' : '#6A6A65',
        fontFamily: 'Instrument Serif, serif',
        fontStyle: 'italic',
      }}>
        {isOver ? `${Math.abs(remaining)} ${unit} drüber` : `${remaining} ${unit} übrig`}
      </div>
    </div>
  );
}
