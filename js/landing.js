/* ========================================================================
   Landing – SOLO API de Usuarios (login + alta de solicitudes)
   ======================================================================== */

/* ========= Endpoints ========= */
const API_USUARIOS_BASE = "http://127.0.0.1:8001"; // Laravel api-usuarios
const FRONT_SOCIOS_URL  = "http://127.0.0.1:5500/frontend_usuarios/index.html";

/* ========= Helpers ========= */
const $ = (sel, root) => (root || document).querySelector(sel);

function setMsgBelowForm(form, text, color) {
  let msg = form.querySelector("[data-form-msg]");
  if (!msg) {
    msg = document.createElement("p");
    msg.dataset.formMsg = "1";
    msg.style.minHeight = "1.25rem";
    msg.style.marginTop = "0.5rem";
    form.appendChild(msg);
  }
  msg.style.whiteSpace = "pre-wrap";
  msg.style.color = color || "#334155";
  msg.textContent = text || "";
}

async function postJSON(url, body, extraHeaders) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function getJSON(url, token) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

function extractToken(possible) {
  return (
    possible?.token ||
    possible?.access_token ||
    possible?.data?.token ||
    possible?.data?.access_token ||
    null
  );
}

/* ===== CI helpers ===== */
function normalizeCI(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}
function looksLikeEmail(v) {
  return /@/.test(String(v || ""));
}
function isValidCI(digitsOnly) {
  return /^\d{7,8}$/.test(String(digitsOnly || ""));
}

/* ========= App ========= */
document.addEventListener("DOMContentLoaded", () => {
  /* ================== LOGIN (landing/login.html) ================== */
  const loginForm = $("#login-form");
  if (loginForm) {
    const loginInput = $("#ci_usuario", loginForm) || $("#login", loginForm);
    if (loginInput) {
      loginInput.addEventListener("input", () => {
        // Si parece CI, normalizo; si parece email, lo dejo como está
        const raw = loginInput.value;
        loginInput.value = looksLikeEmail(raw) ? raw.trim() : normalizeCI(raw);
      });
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = (loginInput?.value || "").trim();
      const loginValue = looksLikeEmail(raw) ? raw : normalizeCI(raw);
      const password = ($("#password", loginForm)?.value || "");

      if ((looksLikeEmail(raw) && !password) ||
          (!looksLikeEmail(raw) && (!isValidCI(loginValue) || !password))) {
        setMsgBelowForm(loginForm, "Completá tu usuario (CI o email) y contraseña.", "#b00");
        return;
      }

      try {
        setMsgBelowForm(loginForm, "Procesando login...");

        // 1) Login en API Usuarios
        const loginResp = await postJSON(`${API_USUARIOS_BASE}/api/login`, {
          login: loginValue, // CI normalizada o email
          password
        });

        const token = extractToken(loginResp);
        if (!token) throw new Error("No llegó token desde API Usuarios.");

        try { localStorage.setItem("token", token); } catch {}

        // 2) Confirmo estado del usuario
        const perfilResp = await getJSON(`${API_USUARIOS_BASE}/api/me`, token);
        const perfil = perfilResp?.user || perfilResp?.data || perfilResp || {};
        const estado = (perfil?.estado_registro ?? perfil?.estado ?? "pendiente").toString().toLowerCase();
        const aprobado = ["aprobado","aprobada","ok","activo","activa","validado","validada"].includes(estado);

        if (!aprobado) {
          setMsgBelowForm(loginForm, "Usuario aún no aprobado por la cooperativa.", "#b00");
          return;
        }

        // 3) Redirijo SOLO al Front de Socios con el token (Landing no toca Backoffice)
        setMsgBelowForm(loginForm, "Login OK. Redirigiendo...", "green");
        window.location.assign(`${FRONT_SOCIOS_URL}#token=${encodeURIComponent(token)}`);
      } catch (err) {
        console.error("Login error:", err);
        const msg =
          err?.errors?.login?.[0] ||
          err?.errors?.password?.[0] ||
          err?.message ||
          err?.error ||
          "Credenciales inválidas.";
        setMsgBelowForm(loginForm, msg, "#b00");
      }
    });
  }

  /* ================== REGISTRO (landing/formulario.html) ================== */
  const regForm = $("#registro-form");
  if (regForm) {
    const ciInput = $("#ci_usuario", regForm);
    if (ciInput) {
      ciInput.addEventListener("input", () => {
        ciInput.value = normalizeCI(ciInput.value);
      });
    }

    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const ci_usuario = normalizeCI($("#ci_usuario")?.value || "");
      const nombre     = ($("#nombre")?.value || "").trim();
      const email      = ($("#email")?.value || "").trim();
      const telefono   = ($("#telefono")?.value || "").trim();
      const menores    = $("#menores_cargo")?.value || "no"; // "si" | "no"
      const dormitorios= parseInt($("#dormitorios")?.value || "1", 10);
      const comentarios= ($("#comentarios")?.value || "").trim();

      if (!isValidCI(ci_usuario)) {
        setMsgBelowForm(regForm, "La CI debe tener 7 u 8 dígitos (solo números).", "#b00");
        ciInput?.focus();
        return;
      }
      if (!nombre || !email || !telefono) {
        setMsgBelowForm(regForm, "Completá todos los campos obligatorios.", "#b00");
        return;
      }

      setMsgBelowForm(regForm, "Enviando solicitud...");

      // Importante: la tabla se llama 'solicitudes' y la columna es 'ci' (no 'ci_usuario')
      // columnas: ci, nombre_completo, email, telefono, menores_a_cargo, dormitorios, comentarios
      const payload = {
        ci: ci_usuario,
        nombre_completo: nombre,
        email,
        telefono,
        menores_a_cargo: menores === "si" ? 1 : 0,
        dormitorios,
        comentarios: comentarios || null,
      };

      try {
        await postJSON(`${API_USUARIOS_BASE}/api/register`, payload);
        setMsgBelowForm(regForm, "¡Solicitud enviada! Te contactaremos cuando sea aprobada.", "green");
        regForm.reset();
      } catch (err) {
        console.error("Registro error:", err);
        const firstError =
          (err?.errors && typeof err.errors === "object" && Object.values(err.errors)[0]?.[0]) ||
          err?.message ||
          err?.error ||
          "No se pudo enviar la solicitud.";
        setMsgBelowForm(regForm, firstError, "#b00");
      }
    });
  }

  /* ================== Logout opcional ================== */
  document.addEventListener("click", (e) => {
    if (e.target && (e.target.matches('[data-logout="1"]') || e.target.id === "logout")) {
      e.preventDefault();
      try { localStorage.removeItem("token"); } catch {}
      window.location.reload();
    }
  });
});