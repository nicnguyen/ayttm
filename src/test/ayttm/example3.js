define(['example3'], function(){

    require(['ayttm.min'], function(_){

            var rotate = (function(){
                var d = document.querySelector('#target');
                var deg = 0;
                var rotate = function(e) {
                    deg = deg + (e.source.clientY - (e.previousEvent.clientY == undefined? e.source.clientY: e.previousEvent.clientY));
                    d.style.webkitTransform = 'rotate(' + deg + 'deg)';
                    d.style.mozTransform    = 'rotate('+deg+'deg)';
                    d.style.msTransform     = 'rotate('+deg+'deg)';
                    d.style.oTransform      = 'rotate('+deg+'deg)';
                    d.style.transform       = 'rotate('+deg+'deg)';
                }
                return rotate;
            })();

            _([
                _('body').shiftkeydown().
                andNext().
                _('#container').mousemove().
                until().
                    _('#target').mousemove().
                    andNext().
                    _([_('#container').mousemove().with(rotate), _('#target').mousemove(), _('#target').mouseleave()]).
                    until().
                        _('body').shiftkeyup()
               ,
                _('#target').mousemove().
                andNext().
                _([_('#target').mousemove(), _().not(_('#target').mouseleave())]).
                    until().
                    _('body').shiftkeydown().
                    andNext().
                    _([_('#container').mousemove().with(rotate), _('#target').mousemove(),_('#target').mouseleave()]).
                    until().
                        _('body').shiftkeyup()

            ]).
            __();
    });
});