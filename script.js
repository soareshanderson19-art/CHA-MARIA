// Importações oficiais do SDK do Firebase via CDN de Módulos
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const PASS = "maria123";
let isAdmin = false;

// Configuração fornecida do seu projeto no Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAd75p7s7PmWgqLRKJ8djmun2awsFlFIaY",
  authDomain: "cha-maria.firebaseapp.com",
  databaseURL: "https://cha-maria-default-rtdb.firebaseio.com",
  projectId: "cha-maria",
  storageBucket: "cha-maria.firebasestorage.app",
  messagingSenderId: "934888505981",
  appId: "1:934888505981:web:8250be0f9e5e5c3e02a714",
  measurementId: "G-ELK3Q90B10"
};

// Inicialização do Firebase e referência ao banco de dados
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Monitoramento de dados em tempo real no banco de dados
document.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem("admin") === "true") {
        enableAdmin();
    }

    // Escuta e renderiza as mudanças de mimos em tempo real (Inicia vazio caso não haja dados)
    onValue(ref(db, 'gifts'), (snapshot) => {
        let gifts = snapshot.val() || [];
        if (gifts && typeof gifts === 'object' && !Array.isArray(gifts)) {
            gifts = Object.values(gifts);
        }
        renderGifts(gifts);
        if (isAdmin) renderAdminGifts(gifts);
    });

    // Escuta e renderiza as mudanças de convidados em tempo real
    onValue(ref(db, 'guests'), (snapshot) => {
        let guests = snapshot.val() || [];
        if (guests && typeof guests === 'object' && !Array.isArray(guests)) {
            guests = Object.values(guests);
        }
        renderDashboard(guests);
    });
});

// Funções utilitárias de leitura rápida do Firebase
const getGiftsPromise = () => {
    return get(ref(db, 'gifts')).then(snap => {
        let val = snap.val() || [];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            val = Object.values(val);
        }
        return val.map(g => ({
            id: g.id,
            name: g.name,
            targetQty: g.targetQty || 1,
            reservations: g.reservations || []
        }));
    });
};

const getGuestsPromise = () => {
    return get(ref(db, 'guests')).then(snap => {
        let val = snap.val() || [];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            return Object.values(val);
        }
        return val;
    });
};

// Interface e Modais
function openMod(id) {
    document.getElementById(id).style.display = "flex";
}
function closeMod(id) { 
    document.getElementById(id).style.display = "none"; 
}
window.onclick = (e) => { 
    if (e.target.classList.contains("modal")) e.target.style.display = "none"; 
};

// Confirmação ou recusa de Presença
function submitPresence(isGoing) {
    const nameInput = document.getElementById("g-name");
    const n = nameInput.value.trim();

    if (!n) {
        alert("Por favor, preencha o seu nome completo.");
        return;
    }

    getGuestsPromise().then(list => {
        let a = 0;
        let k = 0;

        if (isGoing) {
            a = parseInt(document.getElementById("g-adults").value) || 0;
            k = parseInt(document.getElementById("g-kids").value) || 0;
            list.push({ name: n, extraA: a, kids: k, attending: true, date: new Date().toLocaleDateString('pt-BR') });
            alert(`Obrigado, ${n}! Sua presença foi confirmada com sucesso.`);
        } else {
            list.push({ name: n, extraA: 0, kids: 0, attending: false, date: new Date().toLocaleDateString('pt-BR') });
            alert(`Poxa, ${n}. Sentiremos sua falta! Obrigado por nos avisar.`);
        }

        set(ref(db, 'guests'), list).then(() => {
            nameInput.value = "";
            document.getElementById("g-adults").value = "0";
            document.getElementById("g-kids").value = "0";
            closeMod("confirm-mod");
        });
    });
}

// Renderização pública dos mimos
function renderGifts(list) {
    const ul = document.getElementById("g-list");
    ul.innerHTML = "";

    if (list.length === 0) {
        ul.innerHTML = "<li style='justify-content: center; color: #888;'>Nenhum mimo disponível no momento.</li>";
        return;
    }

    const formattedList = list.map(g => ({
        id: g.id,
        name: g.name,
        targetQty: g.targetQty || 1,
        reservations: g.reservations || []
    }));

    // Ordenação: Itens esgotados são enviados para o final
    formattedList.sort((a, b) => {
        const aFull = a.reservations.length >= a.targetQty;
        const bFull = b.reservations.length >= b.targetQty;
        return aFull === bFull ? 0 : aFull ? 1 : -1;
    });

    formattedList.forEach(g => {
        const current = g.reservations.length;
        const limit = g.targetQty;
        const li = document.createElement("li");
        
        li.innerHTML = `<div><span>${g.name}</span> <span class="qty-badge">${current}/${limit}</span></div>`;
        
        if (current >= limit) {
            li.innerHTML += `<span class="btn-res-status">Esgotado</span>`;
        } else {
            li.innerHTML += `<button class="btn-reserve" onclick="reserveMimo(${g.id})">Reservar</button>`;
        }
        ul.appendChild(li);
    });
}

// Reserva imediata sem exigir o nome
function reserveMimo(id) {
    getGiftsPromise().then(list => {
        const i = list.findIndex(g => g.id === id);
        if (i !== -1) {
            const limit = list[i].targetQty;
            if (list[i].reservations.length >= limit) {
                alert("Este item já atingiu a meta de reservas!");
                return;
            }
            list[i].reservations.push("Reservado");
            set(ref(db, 'gifts'), list).then(() => {
                alert("Reserva concluída! Traga também a fralda de sua preferência. Muito obrigado!");
            });
        }
    });
}

// Painel Administrativo
function openAdmin() {
    if (isAdmin) {
        openMod("admin-mod");
        getGuestsPromise().then(list => renderDashboard(list));
        getGiftsPromise().then(list => renderAdminGifts(list));
    } else {
        const p = prompt("Senha:");
        if (p === PASS) {
            enableAdmin();
            alert("Acesso concedido!");
            openMod("admin-mod");
            getGuestsPromise().then(list => renderDashboard(list));
            getGiftsPromise().then(list => renderAdminGifts(list));
        } else if (p !== null) {
            alert("Senha incorreta.");
        }
    }
}

function enableAdmin() {
    isAdmin = true;
    sessionStorage.setItem("admin", "true");
    const i = document.querySelector(".admin-btn i");
    if (i) i.className = "fa-solid fa-lock-open";
}

// Atualização do Painel de Confirmados
function renderDashboard(list) {
    const ul = document.getElementById("guests-ul");
    if (!ul) return;
    ul.innerHTML = "";
    
    let aTotal = 0, kTotal = 0, dTotal = 0;
    if (list.length === 0) {
        ul.innerHTML = "<li>Sem confirmações.</li>";
    }
    
    list.forEach((g, idx) => {
        const li = document.createElement("li");
        const isAttending = g.attending !== false;
        let detailsHTML = "";

        if (isAttending) {
            aTotal += 1 + g.extraA;
            kTotal += g.kids;
            detailsHTML = `
                <div>
                    <strong>${g.name}</strong><br>
                    <small style="color:#16a34a; font-weight:600;">✔ Confirmou (+${g.extraA} ad. e ${g.kids} kid(s))</small>
                </div>`;
        } else {
            dTotal += 1;
            detailsHTML = `
                <div>
                    <strong>${g.name}</strong><br>
                    <small style="color:#dc2626; font-weight:600;">❌ Não poderá ir 😢</small>
                </div>`;
        }
        
        // Incluído botão de Editar junto ao de lixeira
        li.innerHTML = `
            ${detailsHTML}
            <div class="actions">
                <button onclick="editGuest(${idx})" class="btn-edt" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button onclick="delGuest(${idx})" class="btn-del" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        ul.appendChild(li);
    });

    document.getElementById("sum-a").textContent = aTotal;
    document.getElementById("sum-k").textContent = kTotal;
    document.getElementById("sum-t").textContent = aTotal + kTotal;
    document.getElementById("sum-d").textContent = dTotal;
}

// Função para Editar um Convidado Confirmado
function editGuest(idx) {
    getGuestsPromise().then(list => {
        const g = list[idx];
        if (!g) return;

        // 1. Edição do Nome
        const name = prompt("Editar nome completo:", g.name);
        if (name === null) return; // Se cancelar a operação geral

        // 2. Edição do Status de Presença
        let isAttending = g.attending !== false;
        const attendingPrompt = prompt("A pessoa vai comparecer? (Digite S para Sim ou N para Não):", isAttending ? "S" : "N");
        if (attendingPrompt !== null) {
            const ans = attendingPrompt.trim().toUpperCase();
            isAttending = (ans === "S" || ans === "SIM");
        }

        let extraA = g.extraA || 0;
        let kids = g.kids || 0;

        // Se comparecer, pergunta a quantidade de acompanhantes
        if (isAttending) {
            const adultsPrompt = prompt("Quantidade de adultos acompanhantes (além de quem confirmou):", g.extraA || 0);
            if (adultsPrompt !== null) {
                extraA = parseInt(adultsPrompt) || 0;
            }

            const kidsPrompt = prompt("Quantidade de crianças acompanhantes:", g.kids || 0);
            if (kidsPrompt !== null) {
                kids = parseInt(kidsPrompt) || 0;
            }
        } else {
            // Se não for, reseta os acompanhantes
            extraA = 0;
            kids = 0;
        }

        // Salva a alteração no objeto
        list[idx] = {
            ...g,
            name: name.trim() || g.name,
            extraA: extraA,
            kids: kids,
            attending: isAttending
        };

        // Envia as alterações para o Firebase
        set(ref(db, 'guests'), list).then(() => {
            alert("Confirmação de presença editada com sucesso!");
        });
    });
}

// Atualização do Painel de Gerenciamento de Mimos
function renderAdminGifts(list) {
    const ul = document.getElementById("mimos-ul");
    if (!ul) return;
    ul.innerHTML = "";
    
    if (list.length === 0) {
        ul.innerHTML = "<li>Nenhum mimo cadastrado no momento.</li>";
        return;
    }

    list.forEach(g => {
        const resList = g.reservations || [];
        const current = resList.length;
        const limit = g.targetQty || 1;
        const li = document.createElement("li");
        li.style.flexDirection = "column";
        li.style.alignItems = "stretch";

        let tagsHTML = "";
        resList.forEach((name, rIdx) => {
            tagsHTML += `<span class="res-tag">Reserva #${rIdx + 1} <button onclick="releaseMimoSlot(${g.id}, ${rIdx})" title="Excluir">×</button></span>`;
        });

        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
                <div>
                    <strong>${g.name}</strong> 
                    <span class="qty-badge">${current}/${limit}</span>
                </div>
                <div class="actions">
                    <button onclick="editMimo(${g.id})" class="btn-edt"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="delMimo(${g.id})" class="btn-del"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="res-list">${tagsHTML || '<em>Nenhuma reserva</em>'}</div>
        `;
        ul.appendChild(li);
    });
}

function editMimo(id) {
    getGiftsPromise().then(list => {
        const i = list.findIndex(g => g.id === id);
        if (i !== -1) {
            const n = prompt("Novo nome:", list[i].name);
            if (n && n.trim() !== "") {
                const q = prompt("Nova quantidade limite:", list[i].targetQty || 1);
                const num = parseInt(q);
                if (!isNaN(num) && num > 0) {
                    list[i].name = n.trim();
                    list[i].targetQty = num;
                    if (!list[i].reservations) list[i].reservations = [];
                    set(ref(db, 'gifts'), list);
                }
            }
        }
    });
}

function delGuest(idx) {
    if (confirm("Remover esta pessoa/família?")) {
        getGuestsPromise().then(list => {
            list.splice(idx, 1);
            set(ref(db, 'guests'), list);
        });
    }
}

function addMimo(e) {
    e.preventDefault();
    const input = document.getElementById("new-mimo");
    const qtyInput = document.getElementById("new-qty");
    
    const n = input.value.trim();
    const q = parseInt(qtyInput.value) || 1;

    if (n) {
        getGiftsPromise().then(list => {
            const id = list.length > 0 ? Math.max(...list.map(g => g.id)) + 1 : 1;
            list.push({ id, name: n, targetQty: q, reservations: [] });
            set(ref(db, 'gifts'), list).then(() => {
                input.value = "";
                qtyInput.value = "1";
            });
        });
    }
}

function delMimo(id) {
    if (confirm("Remover presente?")) {
        getGiftsPromise().then(list => {
            const updated = list.filter(g => g.id !== id);
            set(ref(db, 'gifts'), updated);
        });
    }
}

function releaseMimoSlot(giftId, resIndex) {
    if (confirm("Remover esta reserva específica?")) {
        getGiftsPromise().then(list => {
            const i = list.findIndex(g => g.id === giftId);
            if (i !== -1) {
                list[i].reservations.splice(resIndex, 1);
                set(ref(db, 'gifts'), list);
            }
        });
    }
}

function switchTab(t) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
    if (t === 'guests') {
        document.getElementById("t-guests").classList.add("active");
        document.getElementById("c-guests").classList.remove("hidden");
        getGuestsPromise().then(list => renderDashboard(list));
    } else if (t === 'manage') {
        document.getElementById("t-manage").classList.add("active");
        document.getElementById("c-manage").classList.remove("hidden");
        getGiftsPromise().then(list => renderAdminGifts(list));
    } else {
        document.getElementById("t-opts").classList.add("active");
        document.getElementById("c-opts").classList.remove("hidden");
    }
}

function logout() {
    isAdmin = false;
    sessionStorage.removeItem("admin");
    const i = document.querySelector(".admin-btn i");
    if (i) i.className = "fa-solid fa-lock";
    closeMod("admin-mod");
    alert("Sair!");
}

function clearAll() {
    if (confirm("Limpar TUDO no Firebase? Isso removerá permanentemente todos os mimos e as confirmações.")) {
        set(ref(db, 'guests'), []);
        set(ref(db, 'gifts'), []).then(() => {
            location.reload();
        });
    }
}

// Vinculação de funções no escopo global (Exclusivo para compatibilidade de módulos em navegadores)
window.openMod = openMod;
window.closeMod = closeMod;
window.submitPresence = submitPresence;
window.reserveMimo = reserveMimo;
window.openAdmin = openAdmin;
window.delGuest = delGuest;
window.editGuest = editGuest; // Função de edição exposta globalmente
window.editMimo = editMimo;
window.delMimo = delMimo;
window.releaseMimoSlot = releaseMimoSlot;
window.switchTab = switchTab;
window.logout = logout;
window.clearAll = clearAll;
window.addMimo = addMimo;
