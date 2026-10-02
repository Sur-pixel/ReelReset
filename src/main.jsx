import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  History,
  LogOut,
  Pencil,
  UserPlus,
  Users,
  X,
  Check,
  CalendarDays,
  Database,
  Trash2
} from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabase";
import "./styles.css";

const key = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0"
  )}`;
};

const dt = k => new Date(k + "T12:00:00");

const add = (k, n) => {
  const d = dt(k);

  d.setDate(d.getDate() + n);

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0"
  )}`;
};

const DEV_PASSWORD = "reelreset-dev";

const fmt = k =>
  dt(k).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

function carried(logs, end = key(), days = 7) {
  const m = new Map(
    logs.map(x => [x.log_date, Number(x.hours)])
  );

  const out = [];
  let c = null;

  for (let i = 1; i <= days; i++) {
    const d = add(end, -i);
    const v = m.get(d);

    if (v !== undefined) {
      c = v;
    }

    if (c !== null) {
      out.push({
        date: d,
        hours: c,
        carried: v === undefined
      });
    }
  }

  return out.reverse();
}

/*
  DAILY USAGE WHEEL

  The important change:
  This wheel displays TODAY'S hours,
  not the 7-day average.
*/
function ProgressWheel({
  hours,
  target,
  label = "Today",
  animationKey = ""
}) {
  const [progress, setProgress] = useState(0);
  const [calibrating, setCalibrating] =
    useState(true);

  const value =
    hours == null ? 0 : Number(hours);

  const safeTarget =
    Number(target) > 0 ? Number(target) : 1;

  const finalProgress = Math.min(
    100,
    (value / safeTarget) * 100
  );

  useEffect(() => {
    setProgress(0);
    setCalibrating(true);

    const start = setTimeout(() => {
      setProgress(finalProgress);
    }, 80);

    const done = setTimeout(() => {
      setCalibrating(false);
    }, 900);

    return () => {
      clearTimeout(start);
      clearTimeout(done);
    };
  }, [animationKey, finalProgress]);

  const color =
    hours == null
      ? "#c9c7bd"
      : value <= safeTarget * 0.8
      ? "#79a86b"
      : value <= safeTarget
      ? "#d2ad45"
      : "#d86c5d";

  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  const offset =
    circumference -
    (progress / 100) * circumference;

  return (
    <div
      className={
        "wheel-wrap " +
        (calibrating ? "wheel-calibrating" : "")
      }
    >
      <svg
        className="wheel"
        viewBox="0 0 140 140"
      >
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#ece9df"
          strokeWidth="11"
        />

        <circle
          className="wheel-progress"
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
        />
      </svg>

      <div className="wheel-center">
        <strong>
          {hours == null
            ? "0.00"
            : value.toFixed(2)}
        </strong>

        <span>hrs</span>
      </div>

      <div className="wheel-label">
        {label}
      </div>
    </div>
  );
}


function UsageGraph({ logs, target }) {
  const [range, setRange] = useState("30");
  const [active, setActive] = useState(null);

  const points = [...(logs || [])]
    .map(x => ({ date: x.log_date, hours: Number(x.hours) }))
    .filter(x => x.date && Number.isFinite(x.hours))
    .sort((a, b) => a.date.localeCompare(b.date));

  const today = key();
  const cutoff = range === "all" ? null : add(today, -(Number(range) - 1));
  const visible = points.filter(x => !cutoff || x.date >= cutoff);

  useEffect(() => {
    setActive(visible.length ? visible[visible.length - 1] : null);
  }, [range, logs]);

  const width = 720;
  const height = 280;
  const left = 48;
  const right = 18;
  const top = 22;
  const bottom = 42;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const maxHours = Math.max(
    Number(target) || 0,
    ...visible.map(x => x.hours),
    1
  );
  const yMax = Math.ceil((maxHours * 1.15) * 2) / 2;
  const y = v => top + plotH - (v / yMax) * plotH;
  const x = i => visible.length <= 1
    ? left + plotW / 2
    : left + (i / (visible.length - 1)) * plotW;

  const coords = visible.map((p, i) => ({ ...p, x: x(i), y: y(p.hours) }));
  const line = coords.map(p => `${p.x},${p.y}`).join(" ");
  const gridValues = [0, yMax / 2, yMax];

  const average = visible.length
    ? visible.reduce((sum, p) => sum + p.hours, 0) / visible.length
    : 0;
  const half = Math.floor(visible.length / 2);
  const firstAvg = half
    ? visible.slice(0, half).reduce((s, p) => s + p.hours, 0) / half
    : 0;
  const second = visible.slice(half);
  const secondAvg = second.length
    ? second.reduce((s, p) => s + p.hours, 0) / second.length
    : 0;
  const change = firstAvg > 0 && second.length
    ? ((secondAvg - firstAvg) / firstAvg) * 100
    : null;
  const best = visible.length
    ? visible.reduce((a, b) => a.hours < b.hours ? a : b)
    : null;

  return (
    <div className="usage-graph">
      <div className="graph-top">
        <div>
          <small>TREND</small>
          <h3>Usage over time</h3>
        </div>
        <div className="graph-range">
          {["7", "30", "90", "all"].map(r => (
            <button
              key={r}
              className={range === r ? "active" : ""}
              onClick={() => setRange(r)}
            >
              {r === "all" ? "All" : `${r}D`}
            </button>
          ))}
        </div>
      </div>

      {visible.length ? (
        <>
          <div className="graph-focus">
            <span>{active ? fmt(active.date) : "Hover a point"}</span>
            <strong>{active ? `${active.hours.toFixed(2)}h` : "—"}</strong>
          </div>

          <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`} role="img">
            {gridValues.map((v, i) => (
              <g key={i}>
                <line
                  className="graph-gridline"
                  x1={left}
                  x2={width - right}
                  y1={y(v)}
                  y2={y(v)}
                />
                <text className="graph-axis" x={left - 10} y={y(v) + 4} textAnchor="end">
                  {v.toFixed(v % 1 ? 1 : 0)}h
                </text>
              </g>
            ))}

            {Number(target) > 0 && (
              <>
                <line
                  className="graph-target"
                  x1={left}
                  x2={width - right}
                  y1={y(Number(target))}
                  y2={y(Number(target))}
                />
                <text className="graph-target-label" x={width - right} y={y(Number(target)) - 7} textAnchor="end">
                  target
                </text>
              </>
            )}

            {coords.length > 1 && (
              <polyline className="graph-line" points={line} fill="none" />
            )}

            {coords.map(point => (
              <g key={point.date}>
                <circle
                  className="graph-hit"
                  cx={point.x}
                  cy={point.y}
                  r="10"
                  onMouseEnter={() => setActive(point)}
                  onClick={() => setActive(point)}
                />
                <circle
                  className={`graph-point ${active?.date === point.date ? "selected" : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                />
              </g>
            ))}

            {coords.length > 0 && (
              <>
                <text className="graph-date" x={left} y={height - 12}>
                  {fmt(coords[0].date)}
                </text>
                {coords.length > 1 && (
                  <text className="graph-date" x={width - right} y={height - 12} textAnchor="end">
                    {fmt(coords[coords.length - 1].date)}
                  </text>
                )}
              </>
            )}
          </svg>

          <div className="graph-summary">
            <div>
              <small>AVERAGE</small>
              <strong>{average.toFixed(2)}h</strong>
            </div>
            <div>
              <small>CHANGE</small>
              <strong className={change == null ? "" : change <= 0 ? "text-good" : "text-bad"}>
                {change == null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
              </strong>
            </div>
            <div>
              <small>LOWEST DAY</small>
              <strong>{best ? `${best.hours.toFixed(2)}h` : "—"}</strong>
            </div>
          </div>
        </>
      ) : (
        <div className="graph-empty">Log a few days to see your usage trend.</div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);

  const [friends, setFriends] = useState([]);
  const [selectedFriendId, setSelectedFriendId] =
    useState(null);

  const [incoming, setIncoming] = useState(null);
  const [outgoing, setOutgoing] = useState(null);
  const [requester, setRequester] = useState(null);

  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [history, setHistory] = useState(false);
  const [friendHistory, setFriendHistory] =
    useState(null);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [devTools, setDevTools] = useState(false);

  async function load(user = session?.user) {
    if (!user) return;

    setError("");

    const {
      data: p,
      error: pe
    } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (pe) throw pe;

    setProfile(p || null);

    if (!p) {
      setSettings(null);
      setFriends([]);
      setSelectedFriendId(null);
      return;
    }

    const [
      { data: s, error: se },
      { data: l, error: le }
    ] = await Promise.all([
      supabase
        .from("reel_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),

      supabase
        .from("reel_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("log_date")
    ]);

    if (se) throw se;
    if (le) throw le;

    setSettings(s || null);
    setLogs(l || []);

    const {
      data: c,
      error: ce
    } = await supabase
      .from("connections")
      .select("*")
      .or(
        `requester_id.eq.${user.id},receiver_id.eq.${user.id}`
      )
      .order("created_at", {
        ascending: false
      });

    if (ce) throw ce;

    const connections = c || [];

    const inc = connections.find(
      x =>
        x.status === "pending" &&
        x.receiver_id === user.id
    );

    const out = connections.find(
      x =>
        x.status === "pending" &&
        x.requester_id === user.id
    );

    const accepted =
      connections.filter(
        x => x.status === "accepted"
      );

    setIncoming(inc || null);
    setOutgoing(out || null);

    if (inc) {
      const { data: rp } =
        await supabase
          .from("profiles")
          .select(
            "id,username,display_name"
          )
          .eq("id", inc.requester_id)
          .maybeSingle();

      setRequester(rp || null);
    } else {
      setRequester(null);
    }

    const friendIds = [
      ...new Set(
        accepted.map(x =>
          x.requester_id === user.id
            ? x.receiver_id
            : x.requester_id
        )
      )
    ];

    if (!friendIds.length) {
      setFriends([]);
      setSelectedFriendId(null);
      return;
    }

    const [
      profilesResult,
      logsResult,
      settingsResult
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .in("id", friendIds),

      supabase
        .from("reel_logs")
        .select("*")
        .in("user_id", friendIds)
        .order("log_date"),

      supabase
        .from("reel_settings")
        .select("*")
        .in("user_id", friendIds)
    ]);

    if (profilesResult.error)
      throw profilesResult.error;

    if (logsResult.error)
      throw logsResult.error;

    if (settingsResult.error)
      throw settingsResult.error;

    const profileRows =
      profilesResult.data || [];

    const logRows =
      logsResult.data || [];

    const settingsRows =
      settingsResult.data || [];

    const nextFriends = friendIds
      .map(id => {
        const fp =
          profileRows.find(
            x => x.id === id
          );

        if (!fp) return null;

        return {
          ...fp,

          logs: logRows.filter(
            x => x.user_id === id
          ),

          settings:
            settingsRows.find(
              x => x.user_id === id
            ) || null
        };
      })
      .filter(Boolean);

    setFriends(nextFriends);

    const localKey =
      `reel-reset-selected-friend:${user.id}`;

    const savedId =
      p.selected_friend_id ||
      localStorage.getItem(localKey);

    const validSavedId =
      savedId &&
      nextFriends.some(
        x => x.id === savedId
      )
        ? savedId
        : nextFriends[0].id;

    setSelectedFriendId(
      validSavedId
    );

    localStorage.setItem(
      localKey,
      validSavedId
    );

    if (
      p.selected_friend_id !==
      validSavedId
    ) {
      const {
        error: selectionError
      } = await supabase
        .from("profiles")
        .update({
          selected_friend_id:
            validSavedId
        })
        .eq("id", user.id);

      if (!selectionError) {
        setProfile(prev =>
          prev
            ? {
                ...prev,
                selected_friend_id:
                  validSavedId
              }
            : prev
        );
      }
    }
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      setSetup(true);
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        setSession(data.session);

        if (data.session) {
          try {
            await load(
              data.session.user
            );
          } catch (e) {
            setError(e.message);
          }
        }

        setLoading(false);
      });

    const { data: l } =
      supabase.auth.onAuthStateChange(
        async (_, s) => {
          setSession(s);

          if (s) {
            try {
              await load(s.user);
            } catch (e) {
              setError(e.message);
            }
          } else {
            setProfile(null);
            setSettings(null);
            setLogs([]);
            setFriends([]);
            setSelectedFriendId(null);
          }
        }
      );

    return () =>
      l.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    const n = new Date();
    const t = new Date(n);

    t.setDate(n.getDate() + 1);
    t.setHours(0, 0, 2, 0);

    const id = setTimeout(
      () => load(session.user),
      t - n
    );

    return () => clearTimeout(id);
  }, [session]);

  async function saveLog(date, hours) {
    const n = Number(hours);

    if (!Number.isFinite(n) || n < 0) {
      throw Error(
        "Enter a valid number."
      );
    }

    const { error: e } =
      await supabase
        .from("reel_logs")
        .upsert(
          {
            user_id: session.user.id,
            log_date: date,
            hours: n,
            updated_at:
              new Date().toISOString()
          },
          {
            onConflict:
              "user_id,log_date"
          }
        );

    if (e) throw e;

    await load();
    setModal(null);
  }

  async function selectFriend(id) {
    if (!id) return;

    if (
      !friends.some(
        x => x.id === id
      )
    ) {
      return;
    }

    setSelectedFriendId(id);

    const localKey =
      `reel-reset-selected-friend:${session.user.id}`;

    localStorage.setItem(
      localKey,
      id
    );

    setProfile(prev =>
      prev
        ? {
            ...prev,
            selected_friend_id:
              id
          }
        : prev
    );

    const { error: e } =
      await supabase
        .from("profiles")
        .update({
          selected_friend_id: id
        })
        .eq("id", session.user.id);

    if (
      e &&
      !String(e.message || "")
        .toLowerCase()
        .includes("selected_friend_id")
    ) {
      setError(e.message);
    }
  }

  async function send(u) {
    u = u.trim().toLowerCase();

    if (!u) {
      throw Error(
        "Enter a username."
      );
    }

    const {
      data: results,
      error
    } = await supabase.rpc(
      "find_profile_by_username",
      {
        wanted_username: u
      }
    );

    if (error) throw error;

    if (
      !results ||
      results.length === 0
    ) {
      throw Error(
        "No user found."
      );
    }

    const target = results[0];

    if (
      target.id ===
      session.user.id
    ) {
      throw Error(
        "You cannot add yourself."
      );
    }

    const { data: old } =
      await supabase
        .from("connections")
        .select("id,status")
        .or(
          `and(requester_id.eq.${session.user.id},receiver_id.eq.${target.id}),and(requester_id.eq.${target.id},receiver_id.eq.${session.user.id})`
        )
        .in("status", [
          "pending",
          "accepted"
        ])
        .maybeSingle();

    if (old) {
      throw Error(
        old.status === "accepted"
          ? "Already friends."
          : "Request already exists."
      );
    }

    const {
      error: connectionError
    } = await supabase
      .from("connections")
      .insert({
        requester_id:
          session.user.id,
        receiver_id: target.id,
        status: "pending"
      });

    if (connectionError)
      throw connectionError;

    await load();
  }

  async function respond(
    id,
    status
  ) {
    const { error: e } =
      await supabase
        .from("connections")
        .update({ status })
        .eq("id", id)
        .eq(
          "receiver_id",
          session.user.id
        )
        .eq("status", "pending");

    if (e) throw e;

    await load();
  }

  async function seedDevData() {
    if (!session?.user || !settings) return;

    const existingDates = new Set(
      logs.map(x => x.log_date)
    );

    const currentTarget = Number(
      settings.current_target ||
        settings.starting_target ||
        4
    );

    const today = key();
    const rows = [];
    const totalDays = 180;

    for (let i = totalDays - 1; i >= 0; i--) {
      const date = add(today, -i);

      if (existingDates.has(date)) continue;

      const progress =
        (totalDays - 1 - i) / (totalDays - 1);

      // Older days are intentionally higher, with a gradual
      // reduction toward the current target.
      let hours =
        currentTarget *
          (1.65 - progress * 0.78);

      const day = dt(date).getDay();
      const weekendBoost =
        day === 0 || day === 6 ? 0.35 : 0;

      const normalNoise =
        (Math.random() - 0.5) *
        Math.max(0.45, currentTarget * 0.22);

      hours += weekendBoost + normalNoise;

      // A few believable bad days.
      if (Math.random() < 0.055) {
        hours *= 1.25 + Math.random() * 0.35;
      }

      // Keep the data useful for both tiny and large targets.
      hours = Math.max(0.15, hours);
      hours = Math.round(hours * 20) / 20;

      rows.push({
        user_id: session.user.id,
        log_date: date,
        hours,
        updated_at: new Date().toISOString()
      });
    }

    if (!rows.length) {
      throw Error(
        "No empty dates were found. Your existing logs already cover the dev range."
      );
    }

    const { data, error: e } =
      await supabase
        .from("reel_logs")
        .insert(rows)
        .select("id,log_date,hours");

    if (e) throw e;

    const storageKey =
      `reel-reset-dev-ids:${session.user.id}`;

    const previous = JSON.parse(
      localStorage.getItem(storageKey) || "[]"
    );

    localStorage.setItem(
      storageKey,
      JSON.stringify([
        ...new Set([
          ...previous,
          ...(data || []).map(x => x.id)
        ])
      ])
    );

    await load();

    return rows.length;
  }

  async function clearDevData() {
    if (!session?.user) return;

    const storageKey =
      `reel-reset-dev-ids:${session.user.id}`;

    const ids = JSON.parse(
      localStorage.getItem(storageKey) || "[]"
    );

    if (!ids.length) {
      throw Error(
        "No generated dev data is saved in this browser."
      );
    }

    const { error: e } =
      await supabase
        .from("reel_logs")
        .delete()
        .eq("user_id", session.user.id)
        .in("id", ids);

    if (e) throw e;

    localStorage.removeItem(storageKey);
    await load();

    return ids.length;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (setup) {
    return (
      <Center>
        <b>Chud Reset</b>
        <p>
          Add your Supabase environment
          variables.
        </p>
      </Center>
    );
  }

  if (loading) {
    return (
      <Center>
        <b>Chud Reset</b>
        <p>Loading…</p>
      </Center>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (!profile || !settings) {
    return (
      <Onboard
        user={session.user}
        reload={load}
      />
    );
  }

  // Calculate the target before the history screen can render.
  // The history page needs this value for the trend graph.
  const target = Number(
    settings.current_target ||
      settings.starting_target
  );

  if (history) {
    return (
      <HistoryPage
        logs={logs}
        target={target}
        back={() => setHistory(false)}
        edit={d =>
          setModal({
            date: d,
            hours:
              logs.find(
                x =>
                  x.log_date === d
              )?.hours ?? ""
          })
        }
      />
    );
  }

  const today = key();

  const todayLog =
    logs.find(
      x => x.log_date === today
    );

  const todayHours =
    todayLog
      ? Number(todayLog.hours)
      : null;

  const selectedFriend =
    friends.find(
      x => x.id === selectedFriendId
    ) ||
    friends[0] ||
    null;

  const friendTodayLog =
    selectedFriend?.logs?.find(
      x => x.log_date === today
    );

  const friendTodayHours =
    friendTodayLog
      ? Number(
          friendTodayLog.hours
        )
      : null;

  const friendTarget =
    Number(
      selectedFriend?.settings
        ?.current_target ||
        target
    );

  return (
    <div className="app">
      <header>
        <b>Chud Reset</b>

        <div className="top">
          <button
            className="dev-button"
            title="Temporary developer tools"
            onClick={() => setDevTools(true)}
          >
            <Database size={17} />
          </button>

          <button
            onClick={() =>
              setHistory(true)
            }
          >
            <History size={17} />
          </button>

          <button onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main>
        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <div className="hero">
          <div>
            <small>
              WEEK{" "}
              {settings.current_week ||
                1}
            </small>

          <h1>
  Chud to Chad
</h1>

<p >
  Only thing changes is "U" 🥀🥀😭
</p>
          </div>

          <div className="target">
            <small>
              Current target
            </small>

            <b>
              {target.toFixed(2)} h/day
            </b>
          </div>
        </div>

        <div className="dashboard-grid">
          {/* =========================
              YOUR DAILY USAGE
          ========================== */}

          <section className="card main-card">
            <div className="section-heading">
              <div>
                <small>
                  YOUR USAGE
                </small>

                <h2>
                  Today
                </h2>
              </div>

              <span
                className={
                  "pill " +
                  (todayHours ==
                  null
                    ? "neutral"
                    : todayHours <=
                      target
                    ? "good"
                    : "bad")
                }
              >
                {todayHours ==
                null
                  ? "No log"
                  : todayHours <=
                    target
                  ? "On track"
                  : "Above target"}
              </span>
            </div>

            <div className="wheel-section">
              <ProgressWheel
                hours={
                  todayHours
                }
                target={target}
                label="Today's usage"
                animationKey={
                  today +
                  "-" +
                  String(
                    todayHours
                  )
                }
              />

              <div className="usage-details">
                <div className="big-stat">
                  <small>
                    DAILY TARGET
                  </small>

                  <strong>
                    {target.toFixed(
                      2
                    )}
                    h
                  </strong>
                </div>

                <div className="big-stat">
                  <small>
                    TODAY
                  </small>

                  <strong>
                    {todayHours ==
                    null
                      ? "0.00"
                      : todayHours.toFixed(
                          2
                        )}
                    h
                  </strong>
                </div>

                <button
                  className="primary"
                  onClick={() =>
                    setModal({
                      date: today,
                      hours:
                        todayLog?.hours ??
                        ""
                    })
                  }
                >
                  {todayLog
                    ? "Edit today"
                    : "Log today"}
                </button>
              </div>
            </div>

            <div className="mini-history">
              <div className="mini-title">
                <span>
                  Recent days
                </span>

                <button
                  onClick={() =>
                    setHistory(true)
                  }
                >
                  View all
                </button>
              </div>

              {logs.length ? (
                [...logs]
                  .reverse()
                  .slice(0, 5)
                  .map(x => (
                    <div
                      className="day"
                      key={x.id}
                    >
                      <div>
                        <b>
                          {fmt(
                            x.log_date
                          )}
                        </b>
                      </div>

                      <div>
                        <b>
                          {Number(
                            x.hours
                          ).toFixed(
                            2
                          )}
                          h
                        </b>

                        <button
                          onClick={() =>
                            setModal({
                              date:
                                x.log_date,
                              hours:
                                x.hours
                            })
                          }
                        >
                          <Pencil
                            size={14}
                          />
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <p>
                  Log your first day
                  to begin.
                </p>
              )}
            </div>
          </section>

          {/* =========================
              FRIEND DAILY USAGE
          ========================== */}

          <section className="card friend-card">
            <div className="friend-panel-head">
              <div>
                <small>
                  FRIENDS
                </small>

                <h2>
                  {friends.length
                    ? "Friend progress"
                    : "Add a friend"}
                </h2>
              </div>

              <Users size={20} />
            </div>

            {friends.length > 0 && (
              <div className="friend-picker">
                <label>
                  Display friend
                </label>

                <select
                  value={
                    selectedFriend?.id ||
                    ""
                  }
                  onChange={e =>
                    selectFriend(
                      e.target.value
                    )
                  }
                >
                  {friends.map(
                    friend => (
                      <option
                        key={
                          friend.id
                        }
                        value={
                          friend.id
                        }
                      >
                        @
                        {
                          friend.username
                        }
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            {selectedFriend ? (
              <>
                <div className="selected-friend-name">
                  @
                  {
                    selectedFriend.username
                  }
                </div>

                <div className="friend-today">
                  <ProgressWheel
                    hours={
                      friendTodayHours
                    }
                    target={
                      friendTarget
                    }
                    label="Today's usage"
                    animationKey={
                      selectedFriend.id +
                      "-" +
                      today +
                      "-" +
                      String(
                        friendTodayHours
                      )
                    }
                  />
                </div>

                <div className="friend-stats">
                  <div>
                    <small>
                      DAILY TARGET
                    </small>

                    <strong>
                      {friendTarget.toFixed(
                        2
                      )}
                      h
                    </strong>
                  </div>

                  <div>
                    <small>
                      TODAY
                    </small>

                    <strong
                      className={
                        friendTodayHours ==
                        null
                          ? ""
                          : friendTodayHours <=
                            friendTarget
                          ? "text-good"
                          : "text-bad"
                      }
                    >
                      {friendTodayHours ==
                      null
                        ? "No log"
                        : friendTodayHours.toFixed(
                            2
                          ) + "h"}
                    </strong>
                  </div>
                </div>

                <div className="friend-status">
                  {friendTodayHours ==
                  null
                    ? "They haven't logged today."
                    : friendTodayHours <=
                      friendTarget
                    ? "On track today"
                    : "Above today's target"}
                </div>

                <button
                  className="friend-log-button"
                  onClick={() =>
                    setFriendHistory(
                      selectedFriend
                    )
                  }
                >
                  <CalendarDays
                    size={16}
                  />
                  View {selectedFriend.username}'s logs
                </button>

                <FriendActions
                  incoming={
                    incoming
                  }
                  outgoing={
                    outgoing
                  }
                  requester={
                    requester
                  }
                  send={send}
                  respond={
                    respond
                  }
                />
              </>
            ) : (
              <Friend
                incoming={incoming}
                outgoing={outgoing}
                requester={requester}
                send={send}
                respond={respond}
              />
            )}
          </section>
        </div>
      </main>

      {modal && (
        <LogModal
          data={modal}
          close={() =>
            setModal(null)
          }
          save={saveLog}
        />
      )}

      {devTools && (
        <DevToolsModal
          close={() => setDevTools(false)}
          seed={seedDevData}
          clear={clearDevData}
        />
      )}

      {friendHistory && (
        <FriendHistoryModal
          friend={friendHistory}
          close={() =>
            setFriendHistory(null)
          }
        />
      )}
    </div>
  );
}

function FriendHistoryModal({
  friend,
  close
}) {
  const [showGraph, setShowGraph] = useState(false);
  const logs = [
    ...(friend.logs || [])
  ].sort((a, b) =>
    b.log_date.localeCompare(a.log_date)
  );

  const target = Number(
    friend.settings?.current_target || 0
  );

  return (
    <div className="overlay">
      <div className="modal card friend-history-modal">
        <div className="row">
          <div>
            <small>FRIEND LOGS</small>
            <h3>@{friend.username}</h3>
          </div>
          <button onClick={close}>
            <X size={17} />
          </button>
        </div>

        <button
          className={`trend-button ${showGraph ? "active" : ""}`}
          onClick={() => setShowGraph(x => !x)}
        >
          {showGraph ? "Hide trends" : "View trends"}
        </button>

        {showGraph && (
          <UsageGraph logs={friend.logs || []} target={target} />
        )}

        <div className="friend-history-list">
          {logs.length ? (
            logs.map(log => (
              <div className="friend-log-row" key={log.id}>
                <div>
                  <b>{fmt(log.log_date)}</b>
                </div>
                <strong>{Number(log.hours).toFixed(2)}h</strong>
              </div>
            ))
          ) : (
            <p>This friend hasn't logged any days yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DevToolsModal({
  close,
  seed,
  clear
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  async function run(action) {
    setMessage("");

    if (!unlocked) {
      if (password !== DEV_PASSWORD) {
        setMessage("Incorrect developer password.");
        return;
      }
      setUnlocked(true);
      return;
    }

    setBusy(true);

    try {
      const count = await action();
      setMessage(
        action === seed
          ? `Imported ${count} realistic test days.`
          : `Removed ${count} generated test days.`
      );
    } catch (e) {
      setMessage(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay">
      <div className="modal card dev-modal">
        <div className="row">
          <div>
            <small>DEVELOPER TOOLS</small>
            <h3>Test data</h3>
          </div>
          <button onClick={close}>
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {!unlocked ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              run(seed);
            }}
          >
            <p>
              Temporary testing tools. Enter the developer
              password to unlock them.
            </p>

            <input
              autoFocus
              type="password"
              placeholder="Developer password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            {message && (
              <div className="error">{message}</div>
            )}

            <button className="primary">
              Unlock
            </button>
          </form>
        ) : (
          <div className="dev-tools-body">
            <div className="dev-warning">
              <strong>Temporary dev mode</strong>
              <span>
                Generates up to 180 realistic daily usage logs.
                Existing logs are never overwritten.
              </span>
            </div>

            <button
              className="primary dev-action"
              disabled={busy}
              onClick={() => run(seed)}
            >
              <Database size={16} />
              {busy ? "Generating…" : "Import random test data"}
            </button>

            <button
              className="dev-danger dev-action"
              disabled={busy}
              onClick={() => run(clear)}
            >
              <Trash2 size={16} />
              {busy ? "Working…" : "Remove generated test data"}
            </button>

            {message && (
              <div className="dev-message">
                {message}
              </div>
            )}
          </div>
        )}

        <small className="dev-footnote">
          Temporary client-side developer feature. Remove it before production.
        </small>
      </div>
    </div>
  );
}

function FriendActions({
  incoming,
  outgoing,
  requester,
  send,
  respond
}) {
  const [u, setU] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] =
    useState(false);

  return (
    <div className="friend-actions">
      {incoming && (
        <div className="friend-request">
          <strong>
            Friend request
          </strong>

          <p>
            <b>
              @
              {requester?.username ||
                "Someone"}
            </b>{" "}
            wants to connect.
          </p>

          <div className="buttons">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);

                try {
                  await respond(
                    incoming.id,
                    "accepted"
                  );
                } catch (e) {
                  setErr(
                    e.message
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Check size={15} />
              Accept
            </button>

            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);

                try {
                  await respond(
                    incoming.id,
                    "declined"
                  );
                } catch (e) {
                  setErr(
                    e.message
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {outgoing && (
        <div className="friend-pending">
          Friend request pending…
        </div>
      )}

      <form
        className="friend"
        onSubmit={async e => {
          e.preventDefault();

          setErr("");
          setBusy(true);

          try {
            await send(u);
            setU("");
          } catch (e) {
            setErr(
              e.message
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          placeholder="@username"
          value={u}
          onChange={e =>
            setU(
              e.target.value
            )
          }
        />

        <button
          className="primary"
          disabled={busy}
        >
          {busy ? "…" : "Add"}
        </button>
      </form>

      {err && (
        <div className="error">
          {err}
        </div>
      )}
    </div>
  );
}

function Center({
  children
}) {
  return (
    <div className="center">
      {children}
    </div>
  );
}

function Auth() {
  const [mode, setMode] =
    useState("login");
  const [email, setEmail] =
    useState("");
  const [pass, setPass] =
    useState("");
  const [user, setUser] =
    useState("");
  const [err, setErr] =
    useState("");
  const [busy, setBusy] =
    useState(false);

  async function go(e) {
    e.preventDefault();

    setErr("");
    setBusy(true);

    try {
      if (mode === "signup") {
        const u =
          user.trim().toLowerCase();

        if (
          !/^[a-z0-9_]{3,20}$/.test(
            u
          )
        ) {
          throw Error(
            "Username: 3–20 letters, numbers, or underscores."
          );
        }

        const { data: old } =
          await supabase
            .from("profiles")
            .select("id")
            .eq("username", u)
            .maybeSingle();

        if (old) {
          throw Error(
            "Username is taken."
          );
        }

        const {
          data,
          error
        } =
          await supabase.auth.signUp(
            {
              email,
              password: pass,
              options: {
                data: {
                  username: u
                }
              }
            }
          );

        if (error)
          throw error;

        if (data.session) {
          await supabase
            .from("profiles")
            .upsert({
              id: data.user.id,
              username: u,
              display_name: u
            });
        } else {
          setErr(
            "Check your email, then log in."
          );
        }
      } else {
        const { error } =
          await supabase.auth.signInWithPassword(
            {
              email,
              password: pass
            }
          );

        if (error)
          throw error;
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Center>
      <div className="auth card">
        <b>Chud Reset</b>

        <p>
          {mode === "login"
            ? "Sign in to continue."
            : "Create your account."}
        </p>

        <form onSubmit={go}>
          {mode === "signup" && (
            <input
              placeholder="@username"
              value={user}
              onChange={e =>
                setUser(
                  e.target.value
                )
              }
            />
          )}

          <input
            placeholder="Email"
            type="email"
            required
            value={email}
            onChange={e =>
              setEmail(
                e.target.value
              )
            }
          />

          <input
            placeholder="Password"
            type="password"
            required
            value={pass}
            onChange={e =>
              setPass(
                e.target.value
              )
            }
          />

          {err && (
            <div className="error">
              {err}
            </div>
          )}

          <button className="primary">
            {busy
              ? "Working…"
              : mode === "login"
              ? "Log in"
              : "Create account"}
          </button>
        </form>

        <button
          className="link"
          onClick={() =>
            setMode(
              mode === "login"
                ? "signup"
                : "login"
            )
          }
        >
          {mode === "login"
            ? "Create an account"
            : "Already have an account? Log in"}
        </button>
      </div>
    </Center>
  );
}

function Onboard({
  user,
  reload
}) {
  const [u, setU] =
    useState(
      user.user_metadata
        ?.username || ""
    );

  const [h, setH] =
    useState("");

  const [err, setErr] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  async function go(e) {
    e.preventDefault();

    setErr("");
    setBusy(true);

    try {
      const n = Number(h);
      const un =
        u.trim().toLowerCase();

      if (!un || n <= 0) {
        throw Error(
          "Enter a username and starting daily hours."
        );
      }

      const { error: pe } =
        await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            username: un,
            display_name: un
          });

      if (pe) throw pe;

      const start = key();

      const { error: se } =
        await supabase
          .from("reel_settings")
          .upsert({
            user_id: user.id,
            starting_target: n,
            current_target: n,
            current_week: 1,
            week_start: start,
            week_end: add(
              start,
              6
            ),
            successful_weeks: 0
          });

      if (se) throw se;

      await reload(user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Center>
      <div className="auth card">
        <b>
          Set up Chud Reset
        </b>

        <p>
          Choose your username
          and starting daily
          Reels time.
        </p>

        <form onSubmit={go}>
          <input
            placeholder="@username"
            value={u}
            onChange={e =>
              setU(
                e.target.value
              )
            }
          />

          <input
            placeholder="Starting hours, e.g. 5"
            type="number"
            min=".1"
            step=".1"
            value={h}
            onChange={e =>
              setH(
                e.target.value
              )
            }
          />

          {err && (
            <div className="error">
              {err}
            </div>
          )}

          <button className="primary">
            {busy
              ? "Saving…"
              : "Start tracking"}
          </button>
        </form>
      </div>
    </Center>
  );
}

function LogModal({
  data,
  close,
  save
}) {
  const [h, setH] =
    useState(data.hours);

  const [err, setErr] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  return (
    <div className="overlay">
      <div className="modal card">
        <div className="row">
          <div>
            <small>
              DAILY USAGE
            </small>

            <h3>
              {fmt(data.date)}
            </h3>
          </div>

          <button
            onClick={close}
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={async e => {
            e.preventDefault();

            setBusy(true);

            try {
              await save(
                data.date,
                h
              );
            } catch (x) {
              setErr(
                x.message
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            autoFocus
            type="number"
            min="0"
            step=".01"
            value={h}
            onChange={e =>
              setH(
                e.target.value
              )
            }
          />

          <small>
            Hours spent on
            Instagram/Reels
          </small>

          {err && (
            <div className="error">
              {err}
            </div>
          )}

          <button className="primary">
            {busy
              ? "Saving…"
              : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

function HistoryPage({
  logs,
  target,
  back,
  edit
}) {
  const [showGraph, setShowGraph] = useState(false);

  return (
    <div className="app">
      <header>
        <button onClick={back}>← Back</button>
        <b>My History</b>
        <span />
      </header>

      <main className="narrow">
        <section className="card">
          <div className="history-toolbar">
            <h3>All logged days</h3>
            <button
              className={`trend-button ${showGraph ? "active" : ""}`}
              onClick={() => setShowGraph(x => !x)}
            >
              {showGraph ? "Hide trends" : "View trends"}
            </button>
          </div>

          {showGraph && (
            <UsageGraph
              logs={logs}
              target={target}
            />
          )}

          {[...logs]
            .reverse()
            .map(x => (
              <div className="day" key={x.id}>
                <b>{fmt(x.log_date)}</b>
                <div>
                  <b>{Number(x.hours).toFixed(2)} h</b>
                  <button onClick={() => edit(x.log_date)}>
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))}
        </section>
      </main>
    </div>
  );
}

function Friend({
  incoming,
  outgoing,
  requester,
  send,
  respond
}) {
  const [u, setU] =
    useState("");

  const [err, setErr] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  if (incoming) {
    return (
      <section>
        <h3>
          Friend request
        </h3>

        <p>
          <b>
            @
            {requester?.username ||
              "Someone"}
          </b>{" "}
          wants to connect.
        </p>

        <div className="buttons">
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);

              try {
                await respond(
                  incoming.id,
                  "accepted"
                );
              } catch (e) {
                setErr(
                  e.message
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Check size={15} />
            Accept
          </button>

          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);

              try {
                await respond(
                  incoming.id,
                  "declined"
                );
              } catch (e) {
                setErr(
                  e.message
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Decline
          </button>
        </div>

        {err && (
          <div className="error">
            {err}
          </div>
        )}
      </section>
    );
  }

  if (outgoing) {
    return (
      <section>
        <h3>
          Friend
        </h3>

        <p>
          Request pending…
        </p>

        <form
          className="friend"
          onSubmit={async e => {
            e.preventDefault();

            setErr("");
            setBusy(true);

            try {
              await send(u);
              setU("");
            } catch (x) {
              setErr(
                x.message
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            placeholder="@username"
            value={u}
            onChange={e =>
              setU(
                e.target.value
              )
            }
          />

          <button
            className="primary"
            disabled={busy}
          >
            {busy
              ? "…"
              : "Add"}
          </button>
        </form>

        {err && (
          <div className="error">
            {err}
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <h3>
        <UserPlus size={17} />
        Add a friend
      </h3>

      <form
        className="friend"
        onSubmit={async e => {
          e.preventDefault();

          setErr("");
          setBusy(true);

          try {
            await send(u);
            setU("");
          } catch (x) {
            setErr(
              x.message
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          placeholder="@username"
          value={u}
          onChange={e =>
            setU(
              e.target.value
            )
          }
        />

        <button
          className="primary"
          disabled={busy}
        >
          {busy
            ? "…"
            : "Send"}
        </button>
      </form>

      {err && (
        <div className="error">
          {err}
        </div>
      )}
    </section>
  );
}

createRoot(
  document.getElementById("root")
).render(<App />);