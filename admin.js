import { sb, S, $, esc, img, cfg, toast, slugify, fdate, upload, pickFile, isAdmin, applyTheme, loadMe, route } from './app.js';

const app = () => $('#app');
const NAV = [
  ['posts', 'Bai viet'], ['new', 'Viet bai moi'], ['cats', 'Chuyen muc'],
  ['comments', 'Binh luan'], ['users', 'Nguoi dung'],
  ['site', 'Cau hinh trang'], ['theme', 'Giao dien'], ['news', 'Newsletter']
];

export async function adminRoute(seg) {
  if (!S.session) { app().innerHTML = '<div class="wrap"><div class="loading">Ban can dang nhap.</div></div>'; return; }
  if (!isAdmin()) { app().innerHTML = '<div class="wrap"><div class="loading">Tai khoan nay khong co quyen quan tri.</div></div>'; return; }
  const tab = seg[0] || 'posts';
  app().innerHTML = `<div class="wrap"><div class="admin">
    <nav>${NAV.map(([k, l]) => `<button data-k="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</nav>
    <section id="apanel"><div class="loading">Dang tai...</div></section></div></div>`;
  document.querySelectorAll('.admin nav button').forEach(b =>
    b.onclick = () => location.hash = '#/admin/' + b.dataset.k);
  const box = $('#apanel');
  if (tab === 'posts') return listPosts(box);
  if (tab === 'new') return editPost(box, null);
  if (tab === 'edit') return editPost(box, seg[1]);
  if (tab === 'cats') return manageCats(box);
  if (tab === 'comments') return manageComments(box);
  if (tab === 'users') return manageUsers(box);
  if (tab === 'site') return siteForm(box);
  if (tab === 'theme') return themeForm(box);
  if (tab === 'news') return newsList(box);
}

const head = (t, extra = '') => `<div class="sec-head" style="margin-top:0"><h2>${t}</h2>${extra}</div>`;

/* ---------- posts ---------- */
async function listPosts(box) {
  const { data } = await sb.from('cvn_posts')
    .select('id,slug,title,status,is_featured,is_editor_pick,is_hot,published_at,view_count,cvn_categories(name)')
    .order('created_at', { ascending: false });
  box.innerHTML = head('Bai viet', '<a href="#/admin/new" style="font-weight:600;color:var(--primary)">Viet bai moi</a>') +
    `<table><tr><th>Tieu de</th><th>Chuyen muc</th><th>Trang thai</th><th>Ngay</th><th>Xem</th><th></th></tr>
    ${(data || []).map(p => `<tr>
      <td><a href="#/p/${esc(p.slug)}" style="font-weight:600">${esc(p.title)}</a>
        <div style="font-size:12px;color:var(--muted)">${[p.is_featured && 'Noi bat', p.is_editor_pick && "Editor's pick", p.is_hot && 'Bai hot'].filter(Boolean).join(' &middot; ')}</div></td>
      <td>${esc(p.cvn_categories?.name || '')}</td>
      <td>${p.status === 'published' ? 'Da dang' : 'Ban nhap'}</td>
      <td>${fdate(p.published_at)}</td><td>${p.view_count || 0}</td>
      <td style="white-space:nowrap"><a class="btn" href="#/admin/edit/${p.id}">Sua</a>
        <button class="btn" data-del="${p.id}">Xoa</button></td></tr>`).join('')}</table>`;
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Xoa bai viet nay?')) return;
    const { error } = await sb.from('cvn_posts').delete().eq('id', b.dataset.del);
    if (error) return toast(error.message, true);
    toast('Da xoa'); listPosts(box);
  });
}

async function editPost(box, id) {
  let p = { title: '', slug: '', subtitle: '', excerpt: '', content: '', cover_url: '', category_id: '', author_label: '', status: 'draft', is_featured: false, is_editor_pick: false, is_hot: false, hot_rank: null };
  let tagStr = '';
  if (id) {
    const { data } = await sb.from('cvn_posts').select('*').eq('id', id).maybeSingle();
    if (!data) { box.innerHTML = '<div class="loading">Khong tim thay bai viet.</div>'; return; }
    p = data;
    const { data: tg } = await sb.from('cvn_post_tags').select('cvn_tags(name)').eq('post_id', id);
    tagStr = (tg || []).map(t => t.cvn_tags.name).join(', ');
  }
  box.innerHTML = head(id ? 'Sua bai viet' : 'Viet bai moi') + `
    <label>Tieu de</label><input type="text" id="f_title" value="${esc(p.title)}">
    <label>Duong dan</label><input type="text" id="f_slug" value="${esc(p.slug)}">
    <label>Tieu de phu</label><input type="text" id="f_sub" value="${esc(p.subtitle || '')}">
    <label>Tom tat hien tren the bai viet</label><textarea id="f_exc">${esc(p.excerpt || '')}</textarea>
    <div class="row2">
      <div><label>Chuyen muc</label><select id="f_cat">
        <option value="">Khong chon</option>
        ${S.cats.map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select></div>
      <div><label>Ten tac gia hien thi</label><input type="text" id="f_author" value="${esc(p.author_label || '')}" placeholder="De trong se lay ten tai khoan"></div>
    </div>
    <label>Anh bia</label>
    <div class="swatch"><img id="f_covp" src="${img(p.cover_url)}" style="height:60px;width:106px;border-radius:8px;object-fit:cover">
      <button class="btn" id="f_covb">Tai anh len</button>
      <button class="btn" id="f_covx">Go anh</button></div>
    <label>Noi dung</label>
    <div class="editor-tools">
      <button data-c="formatBlock" data-v="h2">Tieu de 2</button>
      <button data-c="formatBlock" data-v="h3">Tieu de 3</button>
      <button data-c="formatBlock" data-v="p">Doan van</button>
      <button data-c="bold">Dam</button><button data-c="italic">Nghieng</button>
      <button data-c="insertUnorderedList">Danh sach</button>
      <button data-c="formatBlock" data-v="blockquote">Trich dan</button>
      <button id="f_link">Lien ket</button><button id="f_img">Chen anh</button>
      <button id="f_vid">Chen video</button><button id="f_yt">Chen YouTube</button>
    </div>
    <div id="editor" contenteditable="true">${p.content || ''}</div>
    <div class="row3" style="margin-top:8px">
      <div class="chk"><input type="checkbox" id="f_feat" ${p.is_featured ? 'checked' : ''}><label style="margin:0">Bai noi bat o dau trang</label></div>
      <div class="chk"><input type="checkbox" id="f_pick" ${p.is_editor_pick ? 'checked' : ''}><label style="margin:0">Editor's Picks</label></div>
      <div class="chk"><input type="checkbox" id="f_hot" ${p.is_hot ? 'checked' : ''}><label style="margin:0">Bai hot</label></div>
    </div>
    <div class="row2">
      <div><label>Thu tu trong bang Bai Hot</label><input type="text" id="f_rank" value="${p.hot_rank ?? ''}" placeholder="1 den 5"></div>
      <div><label>Cac the, ngan cach bang dau phay</label><input type="text" id="f_tags" value="${esc(tagStr)}"></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:22px">
      <button class="btn primary" id="f_pub">Dang bai</button>
      <button class="btn" id="f_draft">Luu ban nhap</button>
      ${id ? `<a class="btn" href="#/p/${esc(p.slug)}">Xem truoc</a>` : ''}
    </div>`;

  let cover = p.cover_url || '';
  $('#f_title').oninput = e => { if (!id && !$('#f_slug').dataset.touched) $('#f_slug').value = slugify(e.target.value); };
  $('#f_slug').oninput = e => e.target.dataset.touched = '1';
  $('#f_covb').onclick = () => pickFile(async f => { const u = await upload(f, 'cover'); if (u) { cover = u; $('#f_covp').src = u; } });
  $('#f_covx').onclick = () => { cover = ''; $('#f_covp').src = img(''); };
  box.querySelectorAll('.editor-tools button[data-c]').forEach(b => b.onclick = () => {
    $('#editor').focus(); document.execCommand(b.dataset.c, false, b.dataset.v || null);
  });
  $('#f_link').onclick = () => { const u = prompt('Dan lien ket'); if (u) { $('#editor').focus(); document.execCommand('createLink', false, u); } };
  $('#f_img').onclick = () => pickFile(async f => {
    const u = await upload(f, 'post'); if (!u) return;
    $('#editor').focus(); document.execCommand('insertHTML', false, `<img src="${u}" alt="">`);
  });
  $('#f_vid').onclick = () => pickFile(async f => {
    const u = await upload(f, 'post'); if (!u) return;
    $('#editor').focus();
    document.execCommand('insertHTML', false, `<video src="${u}" controls playsinline style="width:100%;border-radius:12px"></video><p></p>`);
  }, 'video/*');
  $('#f_yt').onclick = () => {
    const u = prompt('Dan lien ket YouTube'); if (!u) return;
    const m = u.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    if (!m) return toast('Lien ket YouTube khong hop le', true);
    $('#editor').focus();
    document.execCommand('insertHTML', false,
      `<div style="position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;margin:20px 0">
<iframe src="https://www.youtube.com/embed/${m[1]}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allowfullscreen loading="lazy"></iframe></div><p></p>`);
  };

  const save = async (status) => {
    const title = $('#f_title').value.trim();
    if (!title) return toast('Chua nhap tieu de', true);
    const rank = parseInt($('#f_rank').value, 10);
    const payload = {
      title, slug: ($('#f_slug').value.trim() || slugify(title)),
      subtitle: $('#f_sub').value, excerpt: $('#f_exc').value,
      content: $('#editor').innerHTML, cover_url: cover || null,
      category_id: $('#f_cat').value || null, author_label: $('#f_author').value || null,
      author_id: p.author_id || S.session.user.id,
      is_featured: $('#f_feat').checked, is_editor_pick: $('#f_pick').checked,
      is_hot: $('#f_hot').checked, hot_rank: Number.isFinite(rank) ? rank : null,
      status, updated_at: new Date().toISOString()
    };
    if (status === 'published' && !p.published_at) payload.published_at = new Date().toISOString();
    let res;
    if (id) res = await sb.from('cvn_posts').update(payload).eq('id', id).select('id').maybeSingle();
    else res = await sb.from('cvn_posts').insert(payload).select('id').maybeSingle();
    if (res.error) return toast(res.error.message, true);
    const postId = res.data.id;
    await syncTags(postId, $('#f_tags').value);
    toast(status === 'published' ? 'Da dang bai' : 'Da luu ban nhap');
    location.hash = '#/admin/posts';
  };
  $('#f_pub').onclick = () => save('published');
  $('#f_draft').onclick = () => save('draft');
}

async function syncTags(postId, raw) {
  const names = raw.split(',').map(s => s.trim()).filter(Boolean);
  await sb.from('cvn_post_tags').delete().eq('post_id', postId);
  for (const name of names) {
    const slug = slugify(name);
    let { data: t } = await sb.from('cvn_tags').select('id').eq('slug', slug).maybeSingle();
    if (!t) t = (await sb.from('cvn_tags').insert({ slug, name }).select('id').maybeSingle()).data;
    if (t) await sb.from('cvn_post_tags').insert({ post_id: postId, tag_id: t.id });
  }
}

/* ---------- categories ---------- */
async function manageCats(box) {
  const { data } = await sb.from('cvn_categories').select('*').order('sort_order');
  box.innerHTML = head('Chuyen muc') + `
    <table><tr><th>Ten</th><th>Duong dan</th><th>Thu tu</th><th>Hien</th><th></th></tr>
    ${(data || []).map(c => `<tr>
      <td><input type="text" value="${esc(c.name)}" data-f="name" data-id="${c.id}"></td>
      <td><input type="text" value="${esc(c.slug)}" data-f="slug" data-id="${c.id}"></td>
      <td style="width:90px"><input type="text" value="${c.sort_order ?? 0}" data-f="sort_order" data-id="${c.id}"></td>
      <td><input type="checkbox" ${c.is_active ? 'checked' : ''} data-f="is_active" data-id="${c.id}"></td>
      <td><button class="btn" data-del="${c.id}">Xoa</button></td></tr>`).join('')}</table>
    <div class="row3" style="margin-top:22px">
      <div><label>Ten chuyen muc moi</label><input type="text" id="nc_name"></div>
      <div><label>Duong dan</label><input type="text" id="nc_slug"></div>
      <div style="display:flex;align-items:flex-end"><button class="btn primary" id="nc_add" style="width:100%">Them</button></div>
    </div>
    <button class="btn primary" id="cat_save" style="margin-top:20px">Luu thay doi</button>`;
  $('#nc_name').oninput = e => $('#nc_slug').value = slugify(e.target.value);
  $('#nc_add').onclick = async () => {
    const name = $('#nc_name').value.trim(); if (!name) return;
    const { error } = await sb.from('cvn_categories').insert({ name, slug: $('#nc_slug').value || slugify(name), sort_order: (data || []).length + 1 });
    if (error) return toast(error.message, true);
    toast('Da them chuyen muc'); await refreshCats(); manageCats(box);
  };
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Xoa chuyen muc nay?')) return;
    await sb.from('cvn_categories').delete().eq('id', b.dataset.del);
    await refreshCats(); manageCats(box);
  });
  $('#cat_save').onclick = async () => {
    const byId = {};
    box.querySelectorAll('[data-id]').forEach(i => {
      byId[i.dataset.id] = byId[i.dataset.id] || {};
      byId[i.dataset.id][i.dataset.f] = i.type === 'checkbox' ? i.checked
        : (i.dataset.f === 'sort_order' ? (parseInt(i.value, 10) || 0) : i.value);
    });
    for (const [id, patch] of Object.entries(byId)) await sb.from('cvn_categories').update(patch).eq('id', id);
    await refreshCats(); toast('Da luu chuyen muc');
  };
}
async function refreshCats() {
  const { data } = await sb.from('cvn_categories').select('*').eq('is_active', true).order('sort_order');
  S.cats = data || [];
}

/* ---------- comments ---------- */
async function manageComments(box) {
  const { data } = await sb.from('cvn_comments')
    .select('id,content,created_at,is_hidden,cvn_profiles(full_name),cvn_posts(title,slug)')
    .order('created_at', { ascending: false }).limit(200);
  box.innerHTML = head('Binh luan') + `<table>
    <tr><th>Noi dung</th><th>Nguoi gui</th><th>Bai viet</th><th>Ngay</th><th></th></tr>
    ${(data || []).map(c => `<tr>
      <td style="max-width:340px">${esc(c.content)}</td>
      <td>${esc(c.cvn_profiles?.full_name || '')}</td>
      <td>${c.cvn_posts ? `<a href="#/p/${esc(c.cvn_posts.slug)}">${esc(c.cvn_posts.title)}</a>` : ''}</td>
      <td>${fdate(c.created_at)}</td>
      <td style="white-space:nowrap">
        <button class="btn" data-hide="${c.id}" data-v="${c.is_hidden ? '0' : '1'}">${c.is_hidden ? 'Hien lai' : 'An'}</button>
        <button class="btn" data-del="${c.id}">Xoa</button></td></tr>`).join('')}</table>`;
  box.querySelectorAll('[data-hide]').forEach(b => b.onclick = async () => {
    await sb.from('cvn_comments').update({ is_hidden: b.dataset.v === '1' }).eq('id', b.dataset.hide);
    manageComments(box);
  });
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Xoa binh luan nay?')) return;
    await sb.from('cvn_comments').delete().eq('id', b.dataset.del); manageComments(box);
  });
}

/* ---------- users ---------- */
async function manageUsers(box) {
  const { data } = await sb.from('cvn_profiles').select('*').order('created_at', { ascending: false });
  box.innerHTML = head('Nguoi dung') + `<table><tr><th></th><th>Ten</th><th>Chuc danh</th><th>Vai tro</th><th>Tham gia</th></tr>
    ${(data || []).map(u => `<tr>
      <td style="width:50px"><img src="${img(u.avatar_url)}" style="height:36px;width:36px;border-radius:50%;object-fit:cover"></td>
      <td>${esc(u.full_name || '')}</td><td>${esc(u.job_title || '')}</td>
      <td><select data-u="${u.id}">
        ${['reader', 'author', 'admin'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select></td>
      <td>${fdate(u.created_at)}</td></tr>`).join('')}</table>`;
  box.querySelectorAll('[data-u]').forEach(s => s.onchange = async () => {
    const { error } = await sb.from('cvn_profiles').update({ role: s.value }).eq('id', s.dataset.u);
    toast(error ? error.message : 'Da doi vai tro', !!error);
  });
}

/* ---------- settings ---------- */
async function saveSetting(key, value) {
  const { error } = await sb.from('cvn_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return toast(error.message, true);
  S.settings[key] = value; toast('Da luu cau hinh');
}

async function siteForm(box) {
  const s = S.settings.site || {}, m = S.settings.menu || {}, f = S.settings.footer || {}, n = S.settings.newsletter || {};
  box.innerHTML = head('Cau hinh trang') + `
    <div class="row2">
      <div><label>Ten trang</label><input type="text" id="s_name" value="${esc(s.name || '')}"></div>
      <div><label>Khau hieu</label><input type="text" id="s_tag" value="${esc(s.tagline || '')}"></div>
    </div>
    <label>Logo</label>
    <div class="swatch"><img id="s_logop" src="${img(s.logo_url)}" style="height:46px;width:46px;border-radius:50%;object-fit:cover">
      <button class="btn" id="s_logob">Tai logo</button><button class="btn" id="s_logox">Go logo</button></div>
    <label>Bieu tuong tab trinh duyet</label>
    <div class="swatch"><img id="s_favp" src="${img(s.favicon_url)}" style="height:30px;width:30px;object-fit:cover">
      <button class="btn" id="s_favb">Tai anh</button></div>
    <div class="sec-head"><h2>Thanh menu</h2></div>
    <div id="menurows"></div>
    <button class="btn" id="m_add">Them muc menu</button>
    <div class="sec-head"><h2>Chan trang</h2></div>
    <label>Gioi thieu ngan</label><textarea id="f_about">${esc(f.about || '')}</textarea>
    <label>Thong tin giay phep, moi dong mot y</label><textarea id="f_lic">${esc(f.license || '')}</textarea>
    <label>Lien ket mang xa hoi, moi dong dang Ten|Duong dan</label>
    <textarea id="f_soc">${esc(Object.entries(f.social || {}).map(([k, v]) => k + '|' + v).join('\n'))}</textarea>
    <div class="sec-head"><h2>Ban tin</h2></div>
    <div class="row2">
      <div><label>Tieu de hop dang ky</label><input type="text" id="n_title" value="${esc(n.title || '')}"></div>
      <div><label>Chu tren nut</label><input type="text" id="n_btn" value="${esc(n.button || '')}"></div>
    </div>
    <button class="btn primary" id="s_save" style="margin-top:24px">Luu tat ca</button>`;

  let logo = s.logo_url || '', fav = s.favicon_url || '';
  $('#s_logob').onclick = () => pickFile(async fl => { const u = await upload(fl, 'brand'); if (u) { logo = u; $('#s_logop').src = u; } });
  $('#s_logox').onclick = () => { logo = ''; $('#s_logop').src = img(''); };
  $('#s_favb').onclick = () => pickFile(async fl => { const u = await upload(fl, 'brand'); if (u) { fav = u; $('#s_favp').src = u; } });

  const rows = [...(m.items || [])];
  const paintMenu = () => {
    $('#menurows').innerHTML = rows.map((it, i) => `<div class="row2" style="margin-bottom:8px">
      <input type="text" value="${esc(it.label)}" data-mi="${i}" data-mf="label" placeholder="Ten hien thi">
      <div style="display:flex;gap:8px"><input type="text" value="${esc(it.href)}" data-mi="${i}" data-mf="href" placeholder="#/c/brands">
      <button class="btn" data-mx="${i}" style="flex:none">Xoa</button></div></div>`).join('');
    $('#menurows').querySelectorAll('[data-mi]').forEach(i =>
      i.oninput = () => rows[+i.dataset.mi][i.dataset.mf] = i.value);
    $('#menurows').querySelectorAll('[data-mx]').forEach(b =>
      b.onclick = () => { rows.splice(+b.dataset.mx, 1); paintMenu(); });
  };
  paintMenu();
  $('#m_add').onclick = () => { rows.push({ label: '', href: '#/' }); paintMenu(); };

  $('#s_save').onclick = async () => {
    const social = {};
    $('#f_soc').value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      const [k, ...v] = l.split('|'); if (k && v.length) social[k.trim()] = v.join('|').trim();
    });
    await saveSetting('site', { name: $('#s_name').value, tagline: $('#s_tag').value, logo_url: logo, favicon_url: fav });
    await saveSetting('menu', { items: rows.filter(r => r.label) });
    await saveSetting('footer', { ...f, about: $('#f_about').value, license: $('#f_lic').value, social });
    await saveSetting('newsletter', { title: $('#n_title').value, button: $('#n_btn').value });
    applyTheme(); route();
  };
}

async function themeForm(box) {
  const t = S.settings.theme || {};
  const field = (id, label, val, fb) => `<div><label>${label}</label>
    <div class="swatch"><input type="color" id="${id}" value="${esc(val || fb)}">
    <input type="text" id="${id}_t" value="${esc(val || fb)}"></div></div>`;
  box.innerHTML = head('Giao dien') + `
    <div class="row3">
      ${field('t_pri', 'Mau chinh', t.primary, '#c62828')}
      ${field('t_ink', 'Mau chu', t.ink, '#12161c')}
      ${field('t_pap', 'Mau nen', t.paper, '#ffffff')}
    </div>
    <div class="row3">
      ${field('t_mut', 'Mau chu phu', t.muted, '#6b7280')}
      <div><label>Do bo goc</label><input type="text" id="t_rad" value="${esc(t.radius || '12px')}"></div>
      <div><label>Phong chu</label><select id="t_font">
        ${['Be Vietnam Pro', 'Inter', 'Roboto', 'Lora', 'Merriweather', 'Playfair Display'].map(f =>
      `<option ${t.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
    </div>
    <p style="color:var(--muted);font-size:14px;margin-top:18px">Doi mau xong bam Luu, trang se doi ngay lap tuc cho moi nguoi truy cap.</p>
    <button class="btn primary" id="t_save" style="margin-top:8px">Luu giao dien</button>`;
  ['t_pri', 't_ink', 't_pap', 't_mut'].forEach(id => {
    $('#' + id).oninput = e => $('#' + id + '_t').value = e.target.value;
    $('#' + id + '_t').oninput = e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) $('#' + id).value = e.target.value; };
  });
  $('#t_save').onclick = async () => {
    await saveSetting('theme', {
      primary: $('#t_pri_t').value, ink: $('#t_ink_t').value, paper: $('#t_pap_t').value,
      muted: $('#t_mut_t').value, radius: $('#t_rad').value, font: $('#t_font').value
    });
    const fam = $('#t_font').value.replace(/ /g, '+');
    if (!document.querySelector(`link[href*="${fam}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${fam}:wght@300;400;600;700;800&display=swap`;
      document.head.appendChild(l);
    }
    applyTheme();
  };
}

async function newsList(box) {
  const { data } = await sb.from('cvn_newsletter').select('*').order('created_at', { ascending: false });
  box.innerHTML = head(`Newsletter (${(data || []).length} dang ky)`) +
    `<table><tr><th>Email</th><th>Ngay dang ky</th></tr>
    ${(data || []).map(r => `<tr><td>${esc(r.email)}</td><td>${fdate(r.created_at)}</td></tr>`).join('')}</table>`;
}
