/* ========================================================================
   Landing – lógica de Login + Registro
   ======================================================================== */

/* ========= Endpoints ========= */
const API_USUARIOS_BASE = "http://127.0.0.1:8001"; // Laravel api-usuarios
const API_COOP_BASE     = "http://127.0.0.1:8002"; // Laravel api-cooperativa
const BACKOFFICE_URL    = "http://127.0.0.1:8003"; // app-backoffice (tiene /sso)
const FRONT_SOCIOS_URL  = "http://127.0.0.1:5500/frontend_usuarios/index.html";

/* ========= Helpers ========= */
function $(sel, root) { return (root || document).querySelector(sel); }

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

/* ========= App ========= */
document.addEventListener("DOMContentLoaded", () => {

  /* ================== LOGIN (landing/login.html) ================== */
  const loginForm =
    $("#login-form") ||
    (function searchLoginFallback(){
      const f = document.querySelector("form");
      if (!f) return null;
      // Compatibilidad: acepta #ci_usuario o #usuario
      const u = $("#ci_usuario", f) || $("#usuario", f);
      const p = $("#password", f);
      return (u && p) ? f : null;
    })();

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Lee CI desde #ci_usuario (recomendado) o #usuario (compatibilidad)
      const ci_usuario =
        ($("#ci_usuario", loginForm)?.value || $("#usuario", loginForm)?.value || "").trim();
      const password = ($("#password", loginForm)?.value || "");

      if (!ci_usuario || !password) {
        setMsgBelowForm(loginForm, "Completá CI y contraseña.", "#b00");
        return;
      }

      try {
        setMsgBelowForm(loginForm, "Procesando login...");

        // 1) Login en API Usuarios
        //    POST http://127.0.0.1:8001/api/login
        //    El backend espera { login, password } (login = CI o email)
        const loginResp = await postJSON(`${API_USUARIOS_BASE}/api/login`, {
          login: ci_usuario,
          password
        });

        const token = extractToken(loginResp);
        if (!token) throw new Error("No llegó token desde API Usuarios.");

        // Guarda token para el front de socios / backoffice
        try { localStorage.setItem("token", token); } catch {}

        // 2) Perfil del usuario autenticado
        //    GET http://127.0.0.1:8001/api/me (con Bearer)
        const perfilResp = await getJSON(`${API_USUARIOS_BASE}/api/me`, token);
        const perfil = perfilResp?.user || perfilResp?.data || perfilResp || {};

        const rol    = perfil?.rol ?? loginResp?.rol ?? loginResp?.user?.rol ?? "socio";
        const estado = perfil?.estado_registro ?? perfil?.estado ?? "pendiente";

        // Normalizar comparaciones
        const rolNorm    = (rol + "").trim().toLowerCase();
        const estadoNorm = (estado + "").trim().toLowerCase();
        const aprobado = ["aprobado","aprobada","ok","activo","activa","validado","validada"].includes(estadoNorm);

        if (!aprobado) {
          setMsgBelowForm(loginForm, "Usuario no aprobado aún.", "#b00");
          return;
        }

        // 3) Redirecciones por rol, PASANDO TOKEN
        if (rolNorm === "admin") {
          setMsgBelowForm(loginForm, "Login OK (admin). Redirigiendo al Backoffice...", "green");
          // Recomendado: /sso?token=<...> para que el backoffice guarde el token
          window.location.assign(`${BACKOFFICE_URL}/sso?token=${encodeURIComponent(token)}`);
        } else {
          setMsgBelowForm(loginForm, "Login OK (socio). Redirigiendo al portal...", "green");
          // Recomendado: pasar token por hash y ya también quedó guardado en localStorage
          window.location.assign(`${FRONT_SOCIOS_URL}#token=${encodeURIComponent(token)}`);
        }
      } catch (err) {
        console.error("Login error:", err);
        const msg =
          err?.errors?.login?.[0] ||
          err?.errors?.ci_usuario?.[0] ||
          err?.errors?.password?.[0] ||
          err?.message ||
          err?.error ||
          "Credenciales inválidas o usuario no aprobado.";
        setMsgBelowForm(loginForm, msg, "#b00");
      }
    });
  }

  /* ================== REGISTRO (landing/formulario.html) ================== */
  const regForm = $("#registro-form");
  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const CI        = $("#CI")?.value.trim() || "";
      const nombre    = $("#nombre")?.value.trim() || "";
      const email     = $("#email")?.value.trim() || "";
      const telefono  = $("#telefono")?.value.trim() || "";
      const menores   = $("#menores_cargo")?.value || "no";   // "si" | "no"
      const interes   = $("#intereses")?.value || "1";        // "1" | "2" | "3"
      const mensaje   = $("#mensaje")?.value.trim() || "";

      if (!CI || !nombre || !email || !telefono) {
        setMsgBelowForm(regForm, "Completá todos los campos obligatorios.", "#b00");
        return;
      }

      setMsgBelowForm(regForm, "Enviando solicitud...");

      // Contrato limpio para la API: boolean + entero
      const payload = {
        ci_usuario: CI,
        nombre_completo: nombre,
        email,
        telefono,
        menores_a_cargo: (menores === "si"), // boolean
        dormitorios: parseInt(interes, 10),  // entero 1..3
        comentarios: mensaje || null,
      };

      try {
        await postJSON(`${API_COOP_BASE}/api/solicitudes`, payload);
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