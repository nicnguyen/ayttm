describe( "LTL tests", function () {

    var $ = ayttm;

    it("Pretty printing", function () {
        var expression = new $.And($.True, $.False);
        expect(expression.toPrettyString()).toEqual("(true And false)");
    });

    it("Negation normal form", function () {

        var expression = new $.Not(new $.And($.True, $.False));
        expression = $.GraphFactory.negationNormalForm(expression);
        expect(expression.toPrettyString()).toEqual("(Not (true) Or Not (false))");

        var expression = new $.Not(new $.Or($.True, new $.Not($.False)));
        expression = $.GraphFactory.negationNormalForm(expression);
        expect(expression.toPrettyString()).toEqual("(Not (true) And false)");

        var expression = new $.Not(new $.Next(new $.Not($.False)));
        expression = $.GraphFactory.negationNormalForm(expression);
        expect(expression.toPrettyString()).toEqual("Next (false)");
    });

    it("Next and new", function () {

        var mu = new $.Expression();
        var psi = new $.Expression();

        var eta = new $.Until(mu, psi);
        expect($.GraphFactory.new1(eta).equals($.Set.singleton(mu))).toBeTruthy();
        expect($.GraphFactory.next1(eta).equals($.Set.singleton(eta))).toBeTruthy();
        expect($.GraphFactory.new2(eta).equals($.Set.singleton(psi))).toBeTruthy();

        var eta = new $.Release(mu, psi);
        expect($.GraphFactory.new1(eta).equals($.Set.singleton(psi))).toBeTruthy();
        expect($.GraphFactory.new1(eta).equals($.Set.singleton(psi))).toBeTruthy();
        expect($.GraphFactory.new2(eta).equals($.Set.fromArray([mu, psi]))).toBeTruthy();

        var eta = new $.Or(mu, psi);
        expect($.GraphFactory.new1(eta).equals($.Set.singleton(mu))).toBeTruthy();
        expect($.GraphFactory.next1(eta).equals($.Set.empty())).toBeTruthy();
        expect($.GraphFactory.new2(eta).equals($.Set.singleton(psi))).toBeTruthy();
    });


    it("Subclasses", function(){

        expect($.True instanceof $.Proposition).toBeTruthy();
    });

    it("Restrictions on trigger", function() {
        var propositionWithTrigger = new $.Proposition({name:'test', trigger : function(event) {}});
        var propositionWithoutTrigger = new $.Proposition({name:'test'});
        expect(propositionWithTrigger.hasTrigger()).toBeTruthy();
        expect(propositionWithoutTrigger.hasTrigger()).toBeFalsy();

        expect($.checkForRestrictionsOnTriggers(new $.Or(propositionWithTrigger, propositionWithTrigger))).toBeTruthy();
        expect($.checkForRestrictionsOnTriggers(new $.Or(propositionWithTrigger, propositionWithoutTrigger))).toBeTruthy();
        expect($.checkForRestrictionsOnTriggers(new $.Or(propositionWithoutTrigger, propositionWithTrigger))).toBeTruthy();
        expect($.checkForRestrictionsOnTriggers(propositionWithoutTrigger)).toBeTruthy();
        expect($.checkForRestrictionsOnTriggers(propositionWithTrigger)).toBeTruthy();
    });

    it("Graph creation", function(){
        var p = new $.Proposition({name:'Graph creation'});
        var expression = new $.Until($.True, p);
        var graphNodesArray = $.GraphFactory.createGraph(expression).toArray();
        expect(graphNodesArray.length).toEqual(4);

        console.log($.GraphFactory.graphNodesToString(graphNodesArray));
        expect($.GraphFactory.graphNodesToString(graphNodesArray)).toEqual('{ name: Node_2, incoming : {init, Node_2} }, { name: Node_6, incoming : {Node_2, init} }, { name: Node_7, incoming : {Node_6, Node_7} }, { name: init, incoming : {} }');
    });

    it("Automaton creation", function() {
        var p = new $.Proposition({name:'Automaton creation'});
        var expression = new $.Until($.True, p);
        var automaton = $.Automaton.fromExpression(expression);
        expect(automaton.states.size()).toEqual(4);

        console.log(automaton.toString());
        expect(automaton.toString()).toEqual('{ name: Node_2, propositions : {}, negatedPropositions : {}, out : {Node_2, Node_6} }, final : false}\n, { name: Node_6, propositions : {Automaton creation}, negatedPropositions : {}, out : {Node_7} }, final : true}\n, { name: Node_7, propositions : {}, negatedPropositions : {}, out : {Node_7} }, final : true}\n, { name: init, propositions : {}, negatedPropositions : {}, out : {Node_2, Node_6} }, final : false}\n');
    });

    it("Automaton run 1 expect accept : (p1:Trigger And Next (p2:Trigger))", function() {
        var value1 = 0;
        var value2 = 0;

        var p1 = new $.Proposition({name:'p1', trigger: function(e){value1 = value1 + 1}});
        var p2 = new $.Proposition({name:'p2', trigger: function(e){value2 = value2 + 2}});
        var e = new $.And(p1, new $.Next(p2));

        expect(e.toPrettyString()).toEqual("(p1:Trigger And Next (p2:Trigger))");

        var automaton = $.Automaton.fromExpression(e);
        automaton.accept({name:"p1"});
        expect(value1).toEqual(1);

        automaton.accept({name:"p2"});
        expect(value2).toEqual(2);
    });

    it("Automaton run 2 expect accept: ((true Until (p1:Trigger And Next (p2:Trigger))) Until false)", function() {

        var value1 = 0;
        var value2 = 0;
        var p1 = new $.Proposition({name:'p1', trigger: function(e){value1 = value1 + 1}});
        var p2 = new $.Proposition({name:'p2', trigger: function(e){value2 = value2 + 2}});
        var e = new $.Until(new $.Until($.True, new $.And(p1, new $.Next(p2))), $.False);

        expect(e.toPrettyString()).toEqual("((true Until (p1:Trigger And Next (p2:Trigger))) Until false)");

        var automaton = $.Automaton.fromExpression(e);
        console.log(automaton.toString());
        for (var i = 0; i < 10; i ++) {
            value1 = 0;
            value2 = 0;
            for (var j = 0; j <= i; ++j) {
                automaton.accept({name:"p1"});
                expect(value1).toEqual(j + 1);
                automaton.accept({name:"p2"});
                expect(value2).toEqual(2 * (j + 1));
            }
        }
    });

    it("Automaton run 3 expect accept, reject, accept: ((true Until (p1:Trigger And Next (p2:Trigger))) Until false)", function() {
        var value1 = 'unset';
        var value2 = 'unset';

        var p1 = new $.Proposition({name:'p1', trigger: function(e){value1 = 'p1'}});
        var p2 = new $.Proposition({name:'p2', trigger: function(e){value2 = 'p2'}});
        var e = new $.Until(new $.Until($.True, new $.And(p1, new $.Next(p2))), $.False);

        expect(e.toPrettyString()).toEqual("((true Until (p1:Trigger And Next (p2:Trigger))) Until false)");

        var automaton = $.Automaton.fromExpression(e);

        automaton.accept({name:"p1"});
        expect(value1).toEqual('p1');
        automaton.accept({name:"p2"});
        expect(value2).toEqual('p2');

        automaton.accept({name:"p1"});
        expect(value1).toEqual('p1');
        automaton.accept({name:"p1"});
        expect(value2).toEqual('p2');

        automaton.accept({name:"p1"});
        expect(value1).toEqual('p1');
        automaton.accept({name:"p2"});
        expect(value2).toEqual('p2');
    });

    it("Automaton run 4 expect: hoverintent", function() {

        var mouseenter =  new $.Proposition({name:"mouseenter", css:"#target"});
        var mouseexit =  new $.Proposition({name:"mouseexit", css:"#target"});
        var mouseenterWithTimer =  new $.PropositionWithSymbolicTrigger({name:"mouseenter", css:"#target"}, new $.StartTimer(300));
        var mouseexitWithTimer =  new $.PropositionWithSymbolicTrigger({name:"mouseexit", css:"#target"}, new $.StartTimer(300));
        var timeoutToggleClass = new $.PropositionWithSymbolicTrigger($.LTLEvents.TimeoutEvent, new $.ToggleClass("#target", "hoverClass"));

        var e = new $.And(
            mouseenterWithTimer,
            new $.Until(
                new $.Not(mouseexit),
                new $.And(
                    timeoutToggleClass,
                    new $.Until(
                        $.True,
                        new $.And(
                            mouseexitWithTimer,
                            new $.Until(
                                new $.Not(mouseexit),
                                timeoutToggleClass
                            )
                        )
                    )
                )
            )
        );

        expect(e.toPrettyString()).toEqual("(mouseenter:#target And (Not (mouseexit:#target) Until (timeout And (true Until (mouseexit:#target And (Not (mouseexit:#target) Until timeout))))))");

        var automaton = $.Automaton.fromExpression(e);

    });
});