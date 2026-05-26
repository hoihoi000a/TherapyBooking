const adminLoginForm = document.querySelector("#adminLoginForm");
const adminUsername = document.querySelector("#adminUsername");
const adminPassword = document.querySelector("#adminPassword");
const loginMessage = document.querySelector("#loginMessage");

if (sessionStorage.getItem("therapyAdminAuthenticated") === "true") {
  location.href = "/admin/reservations";
}

adminLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (adminUsername.value === "admin" && adminPassword.value === "admin") {
    sessionStorage.setItem("therapyAdminAuthenticated", "true");
    location.href = "/admin/reservations";
    return;
  }

  loginMessage.textContent = "帳號或密碼不正確";
  loginMessage.hidden = false;
});