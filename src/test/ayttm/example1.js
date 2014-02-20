define(['example1'], function(){
    require(['ayttm.min'], function(_){

        _('#target').mousedown().
        andNext().
            _('#container').mousemove().
                with(_.mousemoveTracker('#target', '#container')).
            until().
                _('#target').mouseup().
                or().
                _('#container').mouseleave().__();
    });
});


