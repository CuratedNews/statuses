setDarkModeInfo();

function setDarkModeInfo(){
    var isLightMode = false;
    var style;
    const styleSheetsCheck = document.querySelectorAll("link");
    if(styleSheetsCheck){
      styleSheetsCheck.forEach(styleLink => {
        const stylePoint = styleLink.getAttribute("href");
        if (stylePoint.includes("style.css") || stylePoint.includes("styledark.css")){
          style = styleLink;
        }
      });
    }
    const storedTheme = localStorage.getItem('curatednewstheme');
    const check = localStorage.getItem('darkmode');
    const themeColor = document.getElementById("theme-color");
    if(storedTheme){
        style.setAttribute('href', storedTheme);
        if(check.includes("true")){
          document.documentElement.setAttribute("data-theme", "dark");
          style.setAttribute('href', 'static/css/styledark.css');
          if(themeColor){
            themeColor.setAttribute("content", "#3f3f3f");
          }
          isLightMode = false;
        } else {
          document.documentElement.setAttribute("data-theme", "light");
          style.setAttribute('href', 'static/css/style.css');
          if(themeColor){
            themeColor.setAttribute("content", "#242527");
          }
          isLightMode = true;
        }
    } else {
        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if(isDarkMode == true){
          document.documentElement.setAttribute("data-theme", "dark");
          style.setAttribute('href', 'static/css/styledark.css');
          isLightMode = false;
        } else {
          document.documentElement.setAttribute("data-theme", "light");
          style.setAttribute('href', 'static/css/style.css');
          isLightMode = true;
        }
    }
    const darkMode = document.getElementById("dark-mode");
    darkMode.addEventListener('click', function() {
      if (isLightMode) {
        document.body.removeAttribute('data-theme');
        document.documentElement.setAttribute("data-theme", "dark");
        style.setAttribute('href', 'static/css/styledark.css');
        localStorage.setItem('curatednewstheme',"static/css/styledark.css");
        localStorage.setItem('darkmode',"true");
        if(themeColor){
          themeColor.setAttribute("content", "#3f3f3f");
        }
        isLightMode = false;
      } else {
        document.body.removeAttribute('data-theme');
        document.documentElement.setAttribute("data-theme", "light");
        style.setAttribute('href', 'static/css/style.css');
        localStorage.setItem('curatednewstheme',"static/css/style.css");
        localStorage.setItem('darkmode',"false");
        if(themeColor){
          themeColor.setAttribute("content", "#242527");
        }
        isLightMode = true;
      }
    });
  }