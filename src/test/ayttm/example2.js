define(['example2'], function(){

    require(['ayttm.min'], function(_){

        _([
            _('#target').mouseenter().
                with(_.timer(500)).
            andNext().
                not(_('#target').mouseout()).
                until().
                    _(_.timout()).
                    with(_.addClass("#target", "hoverClass")),

            _('#target').mouseout().
            with(_.timer(500)).
            andNext().
                not(_('#target').mouseenter()).
                until().
                    _(_.timout()).
                    with(_.removeClass("#target", "hoverClass"))
        ]).
        __();
    });
});