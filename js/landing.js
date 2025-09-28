/* =========================================================================
   Landing – SOLO API de Usuarios (alta de solicitudes)
   ========================================================================= */

/* ========= Endpoints ========= */
const API_USUARIOS_BASE = "http://127.0.0.1:8001"; // Laravel api-usuarios

/* ========= Helpers ========= */
const $ = (sel, root) => (root || document).querySelector(sel);

// --- Mensaje legacy (debajo del form) - se mantiene por compatibilidad ---
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

// --- Alertas nuevas (bloque .form-alert en el formulario) ---
function getFormAlertEl(form) {
  return form.querySelector(".form-alert");
}
function showFormAlert(form, type, message) {
  const el = getFormAlertEl(form);
  if (!el) return setMsgBelowForm(form, message, type === "error" ? "#b00" : "green");
  el.classList.remove("success", "error", "info");
  if (type) el.classList.add(type);
  el.textContent = message || "";
  el.hidden = false;
}
function hideFormAlert(form) {
  const el = getFormAlertEl(form);
  if (!el) return setMsgBelowForm(form, "");
  el.hidden = true;
  el.textContent = "";
  el.classList.remove("success", "error", "info");
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

/* ===== CI/email helpers ===== */
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
  /* ================== LOGIN (REMOVIDO en landing) ==================
     La landing no maneja login. Si alguien entra a landing/login.html,
     esa página redirige al frontend de socios.
  =================================================================== */

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
      hideFormAlert(regForm);

      const ci_usuario  = normalizeCI($("#ci_usuario")?.value || "");
      const nombre      = ($("#nombre")?.value || "").trim();
      const email       = ($("#email")?.value || "").trim();
      const telefono    = ($("#telefono")?.value || "").trim();
      const menores     = $("#menores_cargo")?.value || "no"; // "si" | "no"
      const dormitorios = parseInt($("#dormitorios")?.value || "1", 10);
      const comentarios = ($("#comentarios")?.value || "").trim();

      if (!isValidCI(ci_usuario)) {
        showFormAlert(regForm, "error", "La CI debe tener 7 u 8 dígitos (solo números).");
        ciInput?.focus();
        return;
      }
      if (!nombre || !email || !telefono) {
        showFormAlert(regForm, "error", "Completá todos los campos obligatorios.");
        return;
      }

      showFormAlert(regForm, "info", "Enviando solicitud...");

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

      // Deshabilitar botón mientras envía
      const submitBtn = regForm.querySelector('button[type="submit"]');
      submitBtn?.setAttribute("disabled", "disabled");

      try {
        await postJSON(`${API_USUARIOS_BASE}/api/register`, payload);
        showFormAlert(regForm, "success", "¡Solicitud enviada! Te contactaremos cuando sea aprobada.");
        setMsgBelowForm(regForm, ""); // limpia mensaje legacy
        regForm.reset();
      } catch (err) {
        console.error("Registro error:", err);
        const firstError =
          (err?.errors && typeof err.errors === "object" && Object.values(err.errors)[0]?.[0]) ||
          err?.message ||
          err?.error ||
          "No se pudo enviar la solicitud.";
        showFormAlert(regForm, "error", firstError);
      } finally {
        submitBtn?.removeAttribute("disabled");
      }
    });
  }

  /* ================== Logout opcional (no activo en landing) ================== */
  document.addEventListener("click", (e) => {
    if (e.target && (e.target.matches('[data-logout="1"]') || e.target.id === "logout")) {
      e.preventDefault();
      try { localStorage.removeItem("token"); } catch {}
      window.location.reload();
    }
  });
});