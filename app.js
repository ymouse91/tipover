/* TipOver – yhdistetty liike/kaato + PERU (undo) + Esc = undo
   Päivitys 12.1.2026: kaadon "tulostus" yksi kerrallaan (askelittain)
*/

const SIZE = 6;
const DIRS = {
  up:{dr:-1,dc:0}, down:{dr:1,dc:0}, left:{dr:0,dc:-1}, right:{dr:0,dc:1},
};

const gridEl      = document.getElementById('grid');
const statusEl    = document.getElementById('status');
const selEl       = document.getElementById('puzzleSelect');
const btnNext     = document.getElementById('btnNext');
const btnRestart  = document.getElementById('btnRestart');
const btnUndo     = document.getElementById('btnUndo');

let PUZZLES=[], currentIndex=0;

// pelitila
let board=null;     // 2D cells
let player=null;    // {r,c}
let startPos=null;
let goalPos=null;
let nextSlabId=1;

// undo-pino
let history=[];

// --- Animaatio / lukitus ---
let inputLocked = false;
// nopeudet (voit säätää):
const TIP_STEP_MS = 85; // kuinka nopeasti seuraava "slab" ilmestyy
const TIP_START_MS = 35; // pieni alkuviive, tekee kaadosta "painavamman"

function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }

function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }
function snapshot(){
  return {
    board: deepCopy(board),
    player: player ? {r:player.r, c:player.c} : null,
    startPos: startPos ? {r:startPos.r, c:startPos.c} : null,
    goalPos: goalPos ? {r:goalPos.r, c:goalPos.c} : null,
    nextSlabId
  };
}
function pushHistory(){
  history.push(snapshot());
  if(history.length>300) history.shift(); // varmuusraja
}
function undo(){
  if(inputLocked){ setStatus('Odota… kaato kesken.', 'warn'); return; }
  if(history.length===0){ setStatus('Ei peruttavaa.', 'warn'); return; }
  const s = history.pop();
  board     = s.board;
  player    = s.player;
  startPos  = s.startPos;
  goalPos   = s.goalPos;
  nextSlabId= s.nextSlabId;
  render();
  setStatus('Peruttu viimeisin siirto/kaato.');
}

function setStatus(msg, cls=''){ statusEl.className='status '+(cls||''); statusEl.textContent=msg; }
function inBounds(r,c){ return r>=0 && c>=0 && r<SIZE && c<SIZE; }
function newEmptyBoard(){ return Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>({kind:'empty'}))); }

function render(){
  gridEl.innerHTML='';
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.r=r; cell.dataset.c=c;
      cell.addEventListener('pointerdown', onCellPointer);
      const it=board[r][c];

      if(it.kind==='upright'){
        const m=document.createElement('div');
        const h=it.h;
        m.className='mark u'+h;
        m.textContent=(h===1?'GOAL':String(h));
        cell.appendChild(m);
      }else if(it.kind==='slab'){
        const m=document.createElement('div');
        m.className='mark slab';
        cell.appendChild(m);
      }

      if(player && player.r===r && player.c===c){
        const p=document.createElement('div');
        p.className='player';
        p.innerHTML='<div></div>';
        cell.appendChild(p);
      }
      gridEl.appendChild(cell);
    }
  }
}

function onCellPointer(e){
  e.preventDefault();
  if(inputLocked) return;

  const r=+e.currentTarget.dataset.r, c=+e.currentTarget.dataset.c;
  const dr=r-player.r, dc=c-player.c;
  if(Math.abs(dr)+Math.abs(dc)!==1) return; // vain viereen
  const dir=(dr===-1&&dc===0)?'up':(dr===1&&dc===0)?'down':(dr===0&&dc===-1)?'left':'right';
  act(dir);
}

function act(dirName){
  if(inputLocked) return;

  const d=DIRS[dirName];

  // 1) yritä LIIKE viereiseen
  const r=player.r+d.dr, c=player.c+d.dc;
  if(inBounds(r,c) && (board[r][c].kind==='upright' || board[r][c].kind==='slab')){
    pushHistory();
    player={r,c};
    checkWin(); render();
    return;
  }

  // 2) muuten yritä KAATOA
  const here=board[player.r][player.c];
  if(here.kind==='upright' && here.h>1 && canTipDir(player.r,player.c,d)){
    pushHistory();
    // askelittain (ei blokata UI-threadiä)
    performTipAnimated(d, dirName);
    return;
  }

  setStatus('Ei laillista siirtoa eikä kaatoa tähän suuntaan.', 'warn');
}

function canTipDir(r,c,dir){
  const here=board[r][c];
  if(here.kind!=='upright' || here.h===1) return false; // goal ei kaadu
  for(let i=1;i<=here.h;i++){
    const rr=r+dir.dr*i, cc=c+dir.dc*i;
    if(!inBounds(rr,cc) || board[rr][cc].kind!=='empty') return false;
  }
  return true;
}

// UUSI: kaato askelittain: slabit ilmestyvät yksi kerrallaan
async function performTipAnimated(dir, dirName){
  if(inputLocked) return;
  inputLocked = true;

  try{
    const r=player.r, c=player.c;
    const h=board[r][c].h;

    // lähtö tyhjäksi heti
    board[r][c] = {kind:'empty'};
    render();

    const slabId=nextSlabId++;

    setStatus(`Kaato suuntaan ${dirName.toUpperCase()} (h=${h})…`);
    await sleep(TIP_START_MS);

    for(let i=1;i<=h;i++){
      const rr=r+dir.dr*i, cc=c+dir.dc*i;
      board[rr][cc] = {kind:'slab', slabId};

      // siirrä pelaaja "kaadon päälle" heti kun ensimmäinen ruutu ilmestyy
      if(i===1){
        player = { r: rr, c: cc };
      }

      render();
      await sleep(TIP_STEP_MS);
    }

    // varmistus: pelaaja on vähintään ensimmäisellä slabilla
    player = { r: r+dir.dr, c: c+dir.dc };

    setStatus(`Kaato suuntaan ${dirName.toUpperCase()} (h=${h}).`);
    checkWin();
    render();
  }finally{
    inputLocked = false;
  }
}

function checkWin(){
  if (goalPos && player.r === goalPos.r && player.c === goalPos.c) {

    if (checkWin.alreadyWon) return;
    checkWin.alreadyWon = true;

    // Odota yksi frame, että renderöinti valmistuu
    requestAnimationFrame(() => {
      flashBoardOnce().then(() => {
        setStatus('Maalissa! 🎉', 'success');
      });
    });
  }
}

/* Pulmien lataus */
async function loadPuzzles(){
  try{
    const resp=await fetch('./tipover_pulmat.json',{cache:'no-store'});
    if(!resp.ok) throw new Error('Ei löytynyt tipover_pulmat.json');
    const data=await resp.json();

    PUZZLES = Array.isArray(data.puzzles) ? data.puzzles
            : Array.isArray(data)        ? data
            : [data];

    if(PUZZLES.length===0) throw new Error('Pulmalista on tyhjä');

    selEl.innerHTML='';
    PUZZLES.forEach((p,i)=>{
      const opt=document.createElement('option');
      opt.value=String(i);
      const counts=`G1-${p.crates.filter(x=>x.h===2).length}-${p.crates.filter(x=>x.h===3).length}-${p.crates.filter(x=>x.h===4).length}`;
      opt.textContent = p.name && p.name !== counts
        ? `${i+1}. ${p.difficulty || '—'} – ${p.name} –  ${counts}`
        : `${i+1}. ${p.difficulty || '—'} – ${counts}`;

      selEl.appendChild(opt);
    });

    currentIndex=0; selEl.value='0';
    loadPuzzle(currentIndex);
    history = []; // tyhjennä undo-pino
    selEl.blur(); gridEl.focus();
    setStatus('Pulmat ladattu.');
  }catch(err){
    console.error(err);
    setStatus('Virhe: '+err.message, 'err');
  }
}

// väläytys ennen ratkaisu-viestiä
async function flashBoardOnce() {
  const board = document.querySelector('.board-wrap');
  if (!board) return;

  const delay = ms => new Promise(res => setTimeout(res, ms));

  for (let i = 0; i < 3; i++) {
    board.classList.add('flash-board');
    await delay(350);   // yhden välähdyksen kesto
    board.classList.remove('flash-board');
    await delay(120);   // tauko välähdysten välissä
  }
}

function loadPuzzle(idx){
  checkWin.alreadyWon = false;

  const p=PUZZLES[idx];
  currentIndex=idx;
  board=newEmptyBoard();

  if(p.goal){
    const {r,c}=p.goal; goalPos={r,c};
    board[r][c]={kind:'upright', h:1};
  }else goalPos=null;

  if(Array.isArray(p.crates)){
    for(const it of p.crates){
      const r=+it.r, c=+it.c, h=+it.h;
      if(goalPos && r===goalPos.r && c===goalPos.c) continue;
      if(inBounds(r,c) && (h===2||h===3||h===4)) board[r][c]={kind:'upright', h};
    }
  }

  if(p.start){ startPos={r:+p.start.r, c:+p.start.c}; player={...startPos}; }
  else{
    startPos=null;
    outer: for(let r=0;r<SIZE;r++){
      for(let c=0;c<SIZE;c++){
        if(board[r][c].kind==='upright' && board[r][c].h>1){ player={r,c}; break outer; }
      }
    }
  }

  nextSlabId = 1;
  history = []; // uusi pulma → tyhjennä undo
  inputLocked = false; // varmuuden vuoksi
  render();
  setStatus(`${idx+1}/${PUZZLES.length} — ${p.name||'(nimetön)'} ${p.difficulty?'• '+p.difficulty:''}`);
  selEl.blur(); gridEl.focus();
}

/* UI */
selEl.addEventListener('change', e=>{
  if(inputLocked) return;
  loadPuzzle(+e.target.value);
});
btnNext.addEventListener('click', ()=>{
  if(inputLocked) return;
  if(currentIndex<PUZZLES.length-1){
    loadPuzzle(currentIndex+1);
    selEl.value=String(currentIndex);
  }
});
btnRestart.addEventListener('click', ()=>{
  if(inputLocked) return;
  loadPuzzle(currentIndex);
});
btnUndo.addEventListener('click', ()=> undo());

/* Näppäimistö: nuolet = act, Esc = undo */
window.addEventListener('keydown', (e)=>{
  const k=e.key;

  if(k==='Escape'){ e.preventDefault(); undo(); return; }

  const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
  if(!map[k]) return;

  if(inputLocked) { e.preventDefault(); return; }

  e.preventDefault();
  if(document.activeElement===selEl) selEl.blur();
  act(map[k]);
},{capture:true});

/* Start */
loadPuzzles();
if(!gridEl.hasAttribute('tabindex')) gridEl.setAttribute('tabindex','0');
