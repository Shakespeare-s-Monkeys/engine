var dom_observer = new MutationObserver(function(mutation) {
    console.log('function called');
});
var container = document.documentElement || document.body;
console.log(container);
var config = { attributes: true, childList: true, characterData: true };
dom_observer.observe(container, config);
