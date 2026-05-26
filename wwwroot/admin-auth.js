if (sessionStorage.getItem("therapyAdminAuthenticated") !== "true") {
  location.replace("/admin");
}