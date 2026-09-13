import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

export const SUPABASE_URL = 'https://fjkyozuggbjpdmumyaxf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_yg8yws1yb5L98x_jD8JsZw_O9yTaieM';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const S = {
  settings: {}, session: null, profile: null, cats: [], liked: new Set(), saved: new Set()
};

/* ---------- helpers ---------- */
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const cfg = (group, key, fb = '') => (S.settings[group] || {})[key] ?? fb;
export const slugify = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 70);
export const fdate = (d) => d ? new Date(d).toLocaleDateString('vi-VN',
  { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
export const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="16" height="10" fill="%23eef0f3"/></svg>');
export const img = (u) => esc(u || PLACEHOLDER);

export function toast(msg, bad) {
  const n = document.createElement('div');
  n.className = 'toast' + (bad ? ' bad' : '');
  n.textContent = msg;
  $('#toast').appendChild(n);
  setTimeout(() => n.remove(), 3200);
}

export function modal(inner, wide) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="overlay"><div class="sheet${wide ? ' wide' : ''}">${inner}</div></div>`;
  root.querySelector('.overlay').addEventListener('mousedown', e => {
    if (e.target.classList.contains('overlay')) closeModal();
  });
  return root;
}
export const closeModal = () => { $('#modal-root').innerHTML = ''; };

export const CLOUD_NAME = 'sjpkbenx';
export const CLOUD_PRESET = 'cvn_unsigned';

export async function upload(file, folder) {
  const kind = file.type.startsWith('video') ? 'video' : 'image';
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUD_PRESET);
  fd.append('folder', 'cvn/' + folder);
  toast('Dang tai len...');
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${kind}/upload`,
      { method: 'POST', body: fd });
    const j = await res.json();
    if (!res.ok) { toast('Tai len that bai: ' + (j.error?.message || res.status), true); return null; }
    return j.secure_url;
  } catch (e) { toast('Tai len that bai: ' + e.message, true); return null; }
}

export function pickFile(cb, accept = 'image/*') {
  const i = document.createElement('input');
  i.type = 'file'; i.accept = accept;
  i.onchange = () => i.files[0] && cb(i.files[0]);
  i.click();
}

const POST_COLS = `id,slug,title,subtitle,excerpt,cover_url,category_id,author_id,author_label,
  status,is_featured,is_editor_pick,is_hot,hot_rank,view_count,published_at,
  cvn_categories(name,slug),cvn_profiles(full_name,avatar_url,job_title)`;

const authorOf = (p) => p.author_label || p.cvn_profiles?.full_name || cfg('site', 'name', 'CVN Digital');
const avatarOf = (p) => p.cvn_profiles?.avatar_url || PLACEHOLDER;

/* ---------- boot ---------- */
async function boot() {
  const [{ data: st }, { data: cats }, { data: { session } }] = await Promise.all([
    sb.from('cvn_settings').select('key,value'),
    sb.from('cvn_categories').select('*').eq('is_active', true).order('sort_order'),
    sb.auth.getSession()
  ]);
  (st || []).forEach(r => S.settings[r.key] = r.value || {});
  S.cats = cats || [];
  S.session = session;
  applyTheme();
  await loadMe();
  sb.auth.onAuthStateChange(async (_e, s) => {
    S.session = s; await loadMe(); renderHeader(); route();
  });
  addEventListener('hashchange', route);
  renderHeader(); renderFooter(); route();
}

export function applyTheme() {
  const t = S.settings.theme || {}, r = document.documentElement.style;
  if (t.primary) r.setProperty('--primary', t.primary);
  if (t.ink) r.setProperty('--ink', t.ink);
  if (t.paper) r.setProperty('--paper', t.paper);
  if (t.muted) r.setProperty('--muted', t.muted);
  if (t.radius) r.setProperty('--radius', t.radius);
  if (t.font) r.setProperty('--font', `"${t.font}"`);
  document.title = cfg('site', 'name', 'CVN Digital');
  const fav = cfg('site', 'favicon_url'); if (fav) $('#favicon').href = fav;
}

export async function loadMe() {
  S.profile = null; S.liked = new Set(); S.saved = new Set();
  if (!S.session) return;
  const uid = S.session.user.id;
  const [{ data: p }, { data: l }, { data: b }] = await Promise.all([
    sb.from('cvn_profiles').select('*').eq('id', uid).maybeSingle(),
    sb.from('cvn_likes').select('post_id').eq('user_id', uid),
    sb.from('cvn_bookmarks').select('post_id').eq('user_id', uid)
  ]);
  S.profile = p;
  (l || []).forEach(x => S.liked.add(x.post_id));
  (b || []).forEach(x => S.saved.add(x.post_id));
}
export const isAdmin = () => S.profile?.role === 'admin';

/* ---------- chrome ---------- */
function renderHeader() {
  const logo = cfg('site', 'logo_url');
  const name = cfg('site', 'name', 'CVN Digital');
  const items = cfg('menu', 'items', []);
  $('#topbar').innerHTML = `<div class="wrap nav">
    <a class="brand" href="#/">
      ${logo ? `<img src="${esc(logo)}" alt="">` : `<span class="dot">${esc(name[0] || 'C')}</span>`}
      <span>${esc(name)}</span>
    </a>
    <nav class="menu">${items.map(i => `<a href="${esc(i.href)}">${esc(i.label)}</a>`).join('')}</nav>
    <div class="navact">
      <form class="search-box" id="sform"><input id="sq" placeholder="Tim bai viet"></form>
      ${isAdmin() ? `<a class="btn" href="#/admin">Quan tri</a>` : ''}
      ${S.session ? `<a href="#/me" title="Trang ca nhan"><img class="avatar-sm" src="${img(S.profile?.avatar_url)}"></a>
         <button class="btn ghost" id="logout">Thoat</button>`
      : `<button class="btn ghost" id="login">Dang nhap</button>
         <button class="btn primary" id="reg">Dang ky</button>`}
    </div></div>`;
  $('#sform').onsubmit = e => { e.preventDefault(); location.hash = '#/search?q=' + encodeURIComponent($('#sq').value); };
  $('#login') && ($('#login').onclick = () => authModal('login'));
  $('#reg') && ($('#reg').onclick = () => authModal('register'));
  $('#logout') && ($('#logout').onclick = async () => { await sb.auth.signOut(); location.hash = '#/'; });
}

function renderFooter() {
  const f = S.settings.footer || {}, name = cfg('site', 'name', 'CVN Digital');
  const cols = (f.columns || []).map(c => `<div class="fcol"><h4>${esc(c.title)}</h4>
    ${(c.links || []).map(l => `<div><a href="${esc(l.href)}">${esc(l.label)}</a></div>`).join('')}</div>`).join('');
  const soc = Object.entries(f.social || {}).map(([k, v]) =>
    `<a href="${esc(v)}" target="_blank" rel="noreferrer">${esc(k)}</a>`).join(' &nbsp; ');
  $('#sitefooter').innerHTML = `<div class="wrap">
    <div class="fgrid">
      <div>
        <div class="brandline">${esc(name)}</div>
        <div>${esc(f.about || cfg('site', 'tagline', ''))}</div>
        ${f.license ? `<div style="margin-top:12px;white-space:pre-line">${esc(f.license)}</div>` : ''}
        <form class="sub" id="nlfoot"><input type="email" id="nlmail" placeholder="Email" required>
          <button>${esc(cfg('newsletter', 'button', 'Dang ky'))}</button></form>
      </div>
      ${cols}
      ${soc ? `<div class="fcol"><h4>Ket noi</h4><div>${soc}</div></div>` : ''}
    </div>
    <div class="bottom">&copy; ${new Date().getFullYear()} ${esc(name)}</div></div>`;
  $('#nlfoot').onsubmit = e => { e.preventDefault(); subscribe($('#nlmail').value, e.target); };
}

async function subscribe(email, form) {
  if (!email) return;
  const { error } = await sb.from('cvn_newsletter').upsert({ email });
  if (error) toast('Khong dang ky duoc: ' + error.message, true);
  else { toast('Da dang ky nhan ban tin'); form.reset(); }
}

/* ---------- router ---------- */
const view = (h) => { $('#app').innerHTML = h; scrollTo(0, 0); };
export function route() {
  const raw = location.hash.slice(2) || '';
  const [path, qs] = raw.split('?');
  const seg = path.split('/').filter(Boolean);
  const q = new URLSearchParams(qs || '');
  $('#app').innerHTML = '<div class="loading">Dang tai...</div>';
  if (seg[0] === 'p') return pagePost(seg[1]);
  if (seg[0] === 'c') return pageCategory(seg[1]);
  if (seg[0] === 'search') return pageSearch(q.get('q') || '');
  if (seg[0] === 'me') return pageProfile();
  if (seg[0] === 'admin') return import('./admin.js').then(m => m.adminRoute(seg.slice(1)));
  if (seg[0] === 'newsletter') return pageNewsletter();
  return pageHome();
}

/* ---------- cards ---------- */
export function cardBig(p) {
  return `<a class="card" href="#/p/${esc(p.slug)}">
    <div class="thumb"><img src="${img(p.cover_url)}" alt=""></div>
    <h3>${esc(p.title)}</h3><p>${esc((p.excerpt || '').slice(0, 110))}</p>
    <div class="byline"><img src="${img(avatarOf(p))}"><b>${esc(authorOf(p))}</b><span>${fdate(p.published_at)}</span></div>
  </a>`;
}
export function cardMini(p) {
  return `<a class="mini" href="#/p/${esc(p.slug)}">
    <div class="thumb"><img src="${img(p.cover_url)}" alt=""></div>
    <div><h4>${esc(p.title)}</h4><div class="meta">${esc(authorOf(p))} &middot; ${fdate(p.published_at)}</div></div></a>`;
}

/* ---------- home ---------- */
async function pageHome() {
  const { data: posts } = await sb.from('cvn_posts').select(POST_COLS)
    .eq('status', 'published').order('published_at', { ascending: false }).limit(60);
  const list = posts || [];
  if (!list.length) return view(`<div class="wrap"><div class="loading">
    Chua co bai viet nao duoc dang.${isAdmin() ? ' Vao muc Quan tri de dang bai dau tien.' : ''}</div></div>`);

  const hero = list.find(p => p.is_featured) || list[0];
  const rest = list.filter(p => p.id !== hero.id);
  const picks = list.filter(p => p.is_editor_pick).slice(0, 5);
  const hot = list.filter(p => p.is_hot).sort((a, b) => (a.hot_rank || 99) - (b.hot_rank || 99)).slice(0, 5);

  const secs = S.cats.map(c => {
    const inCat = list.filter(p => p.category_id === c.id).slice(0, 4);
    if (!inCat.length) return '';
    const [lead, ...small] = inCat;
    return `<div class="sec-head"><h2>${esc(c.name)}</h2><a href="#/c/${esc(c.slug)}">Tat ca</a></div>
      <div class="split"><div>${cardBig(lead)}</div><div>${small.map(cardMini).join('')}</div></div>`;
  }).join('');

  view(`<div class="wrap"><div class="cols"><main>
      <div class="hero">
        <a class="hero-main" href="#/p/${esc(hero.slug)}">
          <img src="${img(hero.cover_url)}" alt="">
          <div class="inner"><h2>${esc(hero.title)}</h2><p>${esc((hero.excerpt || '').slice(0, 150))}</p>
            <div class="byline"><img src="${img(avatarOf(hero))}"><b>${esc(authorOf(hero))}</b><span>${fdate(hero.published_at)}</span></div>
          </div></a>
        <div>${rest[0] ? cardBig(rest[0]) : ''}</div>
      </div>
      <div class="grid3" style="margin-top:26px">${rest.slice(1, 4).map(cardBig).join('')}</div>
      ${secs}
    </main>
    <aside class="side"><div class="side-sticky">
      ${picks.length ? `<div class="picks"><h3>Editor's Picks</h3>
        ${picks.map(p => `<a href="#/p/${esc(p.slug)}">
          <div class="thumb"><img src="${img(p.cover_url)}"></div>
          <div><h4>${esc(p.title)}</h4><div class="meta">${esc(authorOf(p))} &middot; ${fdate(p.published_at)}</div></div></a>`).join('')}
      </div>` : ''}
      <div class="promo"><h4>${esc(cfg('newsletter', 'title', 'Ban tin hang tuan'))}</h4>
        <form id="nlside"><input type="email" id="nlsidemail" placeholder="Email" required>
        <button>${esc(cfg('newsletter', 'button', 'Dang ky'))}</button></form></div>
      ${hot.length ? `<div class="hotbox"><div class="cap">BAI HOT</div>
        ${hot.map((p, i) => `<a class="hotrow" href="#/p/${esc(p.slug)}">
          <div class="num">#${i + 1}</div>
          <div><h4>${esc(p.title)}</h4><div class="meta" style="font-size:12.5px;color:var(--muted)">${esc(authorOf(p))} &middot; ${fdate(p.published_at)}</div></div></a>`).join('')}
      </div>` : ''}
    </div></aside></div></div>`);
  $('#nlside').onsubmit = e => { e.preventDefault(); subscribe($('#nlsidemail').value, e.target); };
}

/* ---------- category / search ---------- */
async function pageCategory(slug) {
  const cat = S.cats.find(c => c.slug === slug);
  if (!cat) return view('<div class="wrap"><div class="loading">Khong tim thay chuyen muc.</div></div>');
  const { data } = await sb.from('cvn_posts').select(POST_COLS).eq('status', 'published')
    .eq('category_id', cat.id).order('published_at', { ascending: false });
  view(`<div class="wrap" style="padding-bottom:60px">
    <div class="sec-head"><h2>${esc(cat.name)}</h2></div>
    ${cat.description ? `<p style="color:var(--muted);margin:-8px 0 20px">${esc(cat.description)}</p>` : ''}
    <div class="grid3">${(data || []).map(cardBig).join('') || '<div class="loading">Chua co bai viet.</div>'}</div></div>`);
}

async function pageSearch(q) {
  const { data } = await sb.from('cvn_posts').select(POST_COLS).eq('status', 'published')
    .or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`).order('published_at', { ascending: false }).limit(40);
  view(`<div class="wrap" style="padding-bottom:60px">
    <div class="sec-head"><h2>Ket qua cho "${esc(q)}"</h2></div>
    <div class="grid3">${(data || []).map(cardBig).join('') || '<div class="loading">Khong co ket qua phu hop.</div>'}</div></div>`);
}

function pageNewsletter() {
  view(`<div class="wrap" style="max-width:620px;padding:60px 20px">
    <h1 style="font-size:34px;font-weight:800;margin:0 0 10px">${esc(cfg('newsletter', 'title', 'Ban tin hang tuan'))}</h1>
    <p style="color:var(--muted)">Nhan tin tuc moi qua email.</p>
    <form id="nlpage" style="display:flex;gap:10px;margin-top:20px">
      <input type="email" id="nlpm" placeholder="Email cua ban" required>
      <button class="btn primary" style="flex:none">${esc(cfg('newsletter', 'button', 'Dang ky'))}</button></form></div>`);
  $('#nlpage').onsubmit = e => { e.preventDefault(); subscribe($('#nlpm').value, e.target); };
}

/* ---------- post ---------- */
async function pagePost(slug) {
  const { data: p } = await sb.from('cvn_posts').select(POST_COLS + ',content').eq('slug', slug).maybeSingle();
  if (!p) return view('<div class="wrap"><div class="loading">Bai viet khong ton tai.</div></div>');
  sb.rpc('cvn_increment_view', { p_slug: slug });

  const [{ data: tg }, { data: rel }, { count: likeCount }] = await Promise.all([
    sb.from('cvn_post_tags').select('cvn_tags(name,slug)').eq('post_id', p.id),
    sb.from('cvn_posts').select(POST_COLS).eq('status', 'published').eq('category_id', p.category_id)
      .neq('id', p.id).order('published_at', { ascending: false }).limit(4),
    sb.from('cvn_likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id)
  ]);

  const liked = S.liked.has(p.id), saved = S.saved.has(p.id);
  view(`<div class="wrap"><div class="cols"><main class="article">
    <div class="tagpills">
      ${p.cvn_categories ? `<a class="pill" href="#/c/${esc(p.cvn_categories.slug)}">${esc(p.cvn_categories.name)}</a>` : ''}
      ${p.status !== 'published' ? '<span class="pill soft">Ban nhap</span>' : ''}
    </div>
    <h1>${esc(p.title)}</h1>
    ${p.subtitle ? `<p class="sub">${esc(p.subtitle)}</p>` : ''}
    ${p.cover_url ? `<div class="cover"><img src="${esc(p.cover_url)}" alt=""></div>` : ''}
    <div class="authorbar">
      <div class="who"><img src="${img(avatarOf(p))}">
        <div><div>Boi <b>${esc(authorOf(p))}</b></div>
        <div class="role">${esc(p.cvn_profiles?.job_title || '')}${p.cvn_profiles?.job_title ? ' &middot; ' : ''}${fdate(p.published_at)} &middot; ${p.view_count || 0} luot xem</div></div>
      </div>
      <div class="acts">
        <button class="iconbtn${liked ? ' on' : ''}" id="blike" title="Yeu thich">&#9829;</button>
        <button class="iconbtn${saved ? ' on' : ''}" id="bsave" title="Luu bai">&#9733;</button>
        <button class="iconbtn" id="bcopy" title="Sao chep lien ket">&#128279;</button>
        <span style="align-self:center;font-size:13px;color:var(--muted)" id="likec">${likeCount || 0}</span>
      </div>
    </div>
    <div class="body">${p.content || ''}</div>
    ${(tg || []).length ? `<div class="tagpills" style="margin:28px 0">${tg.map(t =>
    `<a class="pill soft" href="#/search?q=${encodeURIComponent(t.cvn_tags.name)}">#${esc(t.cvn_tags.name)}</a>`).join('')}</div>` : ''}
    <div id="cmts"></div>
    ${(rel || []).length ? `<div class="sec-head"><h2>Bai viet lien quan</h2></div>
      <div class="grid4">${rel.map(cardBig).join('')}</div>` : ''}
  </main>
  <aside class="side"><div class="side-sticky">
    <div class="promo"><h4>${esc(cfg('newsletter', 'title', 'Ban tin hang tuan'))}</h4>
      <form id="nlart"><input type="email" id="nlam" placeholder="Email" required>
      <button>${esc(cfg('newsletter', 'button', 'Dang ky'))}</button></form></div>
  </div></aside></div></div>`);

  $('#nlart').onsubmit = e => { e.preventDefault(); subscribe($('#nlam').value, e.target); };
  $('#bcopy').onclick = () => { navigator.clipboard.writeText(location.href); toast('Da sao chep lien ket'); };
  $('#blike').onclick = () => toggleRel('cvn_likes', p.id, S.liked, $('#blike'), $('#likec'));
  $('#bsave').onclick = () => toggleRel('cvn_bookmarks', p.id, S.saved, $('#bsave'));
  renderComments(p);
}

async function toggleRel(table, postId, set, btn, counter) {
  if (!S.session) return authModal('login');
  const uid = S.session.user.id, on = set.has(postId);
  if (on) { await sb.from(table).delete().eq('post_id', postId).eq('user_id', uid); set.delete(postId); }
  else { await sb.from(table).insert({ post_id: postId, user_id: uid }); set.add(postId); }
  btn.classList.toggle('on', !on);
  if (counter) counter.textContent = Math.max(0, (+counter.textContent) + (on ? -1 : 1));
  toast(on ? 'Da bo khoi danh sach' : 'Da them vao danh sach');
}

async function renderComments(p) {
  const { data } = await sb.from('cvn_comments')
    .select('id,content,created_at,user_id,cvn_profiles(full_name,avatar_url)')
    .eq('post_id', p.id).eq('is_hidden', false).order('created_at', { ascending: false });
  const box = $('#cmts');
  box.innerHTML = `<div class="sec-head"><h2>Binh luan (${(data || []).length})</h2></div>
    ${S.session ? `<form id="cf"><textarea id="ctext" placeholder="Viet binh luan cua ban" required></textarea>
      <button class="btn primary" style="margin-top:10px">Gui binh luan</button></form>`
      : `<p style="color:var(--muted)">Ban can <a href="#" id="cl" style="color:var(--primary);font-weight:600">dang nhap</a> de binh luan.</p>`}
    <div style="margin-top:18px">${(data || []).map(c => `<div class="cmt">
      <img src="${img(c.cvn_profiles?.avatar_url)}">
      <div><div class="meta"><b>${esc(c.cvn_profiles?.full_name || 'Nguoi dung')}</b> &middot; ${fdate(c.created_at)}</div>
      <div>${esc(c.content)}</div></div></div>`).join('') || '<p style="color:var(--muted)">Chua co binh luan nao.</p>'}</div>`;
  $('#cl') && ($('#cl').onclick = e => { e.preventDefault(); authModal('login'); });
  $('#cf') && ($('#cf').onsubmit = async e => {
    e.preventDefault();
    const content = $('#ctext').value.trim(); if (!content) return;
    const { error } = await sb.from('cvn_comments').insert({ post_id: p.id, user_id: S.session.user.id, content });
    if (error) return toast(error.message, true);
    toast('Da gui binh luan'); renderComments(p);
  });
}

/* ---------- auth ---------- */
export function authModal(mode) {
  const reg = mode === 'register';
  modal(`<h3>${reg ? 'Tao tai khoan' : 'Dang nhap'}</h3>
    <p class="lead">${reg ? 'Dang ky de luu bai, yeu thich va binh luan.' : 'Dang nhap de tiep tuc.'}</p>
    <form id="af">
      ${reg ? '<label>Ho va ten</label><input type="text" id="afname" required>' : ''}
      <label>Email</label><input type="email" id="afmail" required>
      <label>Mat khau</label><input type="password" id="afpass" minlength="6" required>
      <button class="btn primary" style="width:100%;margin-top:18px">${reg ? 'Dang ky' : 'Dang nhap'}</button>
    </form>
    <p style="margin:14px 0 0;font-size:14px;color:var(--muted)">
      ${reg ? 'Da co tai khoan?' : 'Chua co tai khoan?'}
      <a href="#" id="swap" style="color:var(--primary);font-weight:600">${reg ? 'Dang nhap' : 'Dang ky'}</a></p>`);
  $('#swap').onclick = e => { e.preventDefault(); authModal(reg ? 'login' : 'register'); };
  $('#af').onsubmit = async e => {
    e.preventDefault();
    const email = $('#afmail').value, password = $('#afpass').value;
    const btn = e.target.querySelector('button'); btn.disabled = true;
    const { error } = reg
      ? await sb.auth.signUp({ email, password, options: { data: { full_name: $('#afname').value } } })
      : await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if (error) return toast(error.message, true);
    closeModal();
    toast(reg ? 'Tao tai khoan thanh cong' : 'Da dang nhap');
  };
}

/* ---------- profile ---------- */
async function pageProfile() {
  if (!S.session) { view('<div class="wrap"><div class="loading">Ban can dang nhap.</div></div>'); return authModal('login'); }
  const uid = S.session.user.id, p = S.profile || {};
  const [{ data: likes }, { data: saves }, { data: cmts }] = await Promise.all([
    sb.from('cvn_likes').select(`post_id,cvn_posts(${POST_COLS})`).eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('cvn_bookmarks').select(`post_id,cvn_posts(${POST_COLS})`).eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('cvn_comments').select(`id,content,created_at,cvn_posts(${POST_COLS})`).eq('user_id', uid).order('created_at', { ascending: false })
  ]);
  const lp = (likes || []).map(x => x.cvn_posts).filter(Boolean);
  const sp = (saves || []).map(x => x.cvn_posts).filter(Boolean);

  view(`<div class="wrap" style="padding:24px 20px 60px">
    <div class="cover">${p.cover_url ? `<img src="${esc(p.cover_url)}">` : ''}</div>
    <div class="phead">
      <img class="av" src="${img(p.avatar_url)}">
      <div style="flex:1;padding-bottom:6px">
        <h1>${esc(p.full_name || 'Nguoi dung')}</h1>
        <div class="role">${esc(p.job_title || '')}${p.job_title ? ' &middot; ' : ''}${esc(p.role || 'reader')}</div>
      </div>
      <button class="btn" id="pedit" style="margin-bottom:8px">Chinh sua ho so</button>
    </div>
    ${p.bio ? `<p style="margin:18px 24px 0;max-width:720px;color:var(--muted)">${esc(p.bio)}</p>` : ''}
    <div class="tabs" style="margin-left:24px">
      <button class="on" data-t="like">Bai da thich (${lp.length})</button>
      <button data-t="cmt">Da binh luan (${(cmts || []).length})</button>
      <button data-t="save">Bai da luu (${sp.length})</button>
    </div>
    <div id="ptab"></div></div>`);

  const empty = (t) => `<p style="color:var(--muted)">${t}</p>`;
  const paint = (t) => {
    const box = $('#ptab');
    if (t === 'like') box.innerHTML = lp.length ? `<div class="grid3">${lp.map(cardBig).join('')}</div>` : empty('Chua thich bai nao.');
    else if (t === 'save') box.innerHTML = sp.length ? `<div class="grid3">${sp.map(cardBig).join('')}</div>` : empty('Chua luu bai nao.');
    else box.innerHTML = (cmts || []).length ? (cmts.map(c => `<div class="cmtcard">
        <p class="said">${esc(c.content)}</p>
        <div style="font-size:12.5px;color:var(--muted);margin-bottom:10px">${fdate(c.created_at)}</div>
        ${c.cvn_posts ? `<a class="ref" href="#/p/${esc(c.cvn_posts.slug)}">
          <div class="thumb"><img src="${img(c.cvn_posts.cover_url)}"></div>
          <div><h4>${esc(c.cvn_posts.title)}</h4>
          <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${fdate(c.cvn_posts.published_at)}</div></div></a>` : ''}
      </div>`).join('')) : empty('Chua binh luan bai nao.');
  };
  paint('like');
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); paint(b.dataset.t);
  });
  $('#pedit').onclick = () => editProfile(p);
}

function editProfile(p) {
  modal(`<h3>Chinh sua ho so</h3>
    <label>Ho va ten</label><input type="text" id="ef_name" value="${esc(p.full_name || '')}">
    <label>Chuc danh</label><input type="text" id="ef_job" value="${esc(p.job_title || '')}">
    <label>Gioi thieu</label><textarea id="ef_bio">${esc(p.bio || '')}</textarea>
    <label>Anh dai dien</label>
    <div class="swatch"><img id="ef_avp" src="${img(p.avatar_url)}" style="height:54px;width:54px;border-radius:50%;object-fit:cover">
      <button class="btn" id="ef_avb">Tai anh len</button></div>
    <label>Anh bia</label>
    <div class="swatch"><img id="ef_cvp" src="${img(p.cover_url)}" style="height:54px;width:96px;border-radius:8px;object-fit:cover">
      <button class="btn" id="ef_cvb">Tai anh len</button></div>
    <div style="display:flex;gap:10px;margin-top:22px">
      <button class="btn primary" id="ef_save" style="flex:1">Luu</button>
      <button class="btn" id="ef_cancel" style="flex:1">Huy</button></div>`);
  let avatar = p.avatar_url || null, cover = p.cover_url || null;
  $('#ef_avb').onclick = () => pickFile(async f => { const u = await upload(f, 'avatar'); if (u) { avatar = u; $('#ef_avp').src = u; } });
  $('#ef_cvb').onclick = () => pickFile(async f => { const u = await upload(f, 'cover'); if (u) { cover = u; $('#ef_cvp').src = u; } });
  $('#ef_cancel').onclick = closeModal;
  $('#ef_save').onclick = async () => {
    const { error } = await sb.from('cvn_profiles').update({
      full_name: $('#ef_name').value, job_title: $('#ef_job').value,
      bio: $('#ef_bio').value, avatar_url: avatar, cover_url: cover
    }).eq('id', S.session.user.id);
    if (error) return toast(error.message, true);
    await loadMe(); closeModal(); renderHeader(); route(); toast('Da luu ho so');
  };
}

export { POST_COLS, renderHeader, renderFooter, view };
boot();
