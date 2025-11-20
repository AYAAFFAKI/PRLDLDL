(function(){
  // Internal helper to add/remove the flash class for 5 seconds
  function flash(cls){
    document.body.classList.remove('flash-green','flash-red');
    // reflow to restart CSS animation if same class is re-used quickly
    void document.body.offsetWidth;
    document.body.classList.add(cls);
    setTimeout(()=>{document.body.classList.remove(cls);},5000);
  }
  // Public API: green flash on add
  function flashGreen(){ flash('flash-green'); }
  // Public API: red flash on delete
  function flashRed(){ flash('flash-red'); }
  window.animations = { flashGreen, flashRed };
})();
