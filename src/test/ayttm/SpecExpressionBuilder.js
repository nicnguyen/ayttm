describe( "ExpressionBuilder tests", function () {

    var _ = ayttm._;

    it("Create expression: (one And two)  ", function () {
        var b = _({name:'one'}).and(_({name:'two'}));
        var e = b.buildExpression();
        expect(e.toPrettyString()).toEqual("(one And two)");
    });

    it("Create expression: ((one And two) Until three)", function () {
        var b = _(_({name:'one'}).and(_({name:'two'}))).until(_({name:'three'}));
        var e = b.buildExpression();
        expect(e.toPrettyString()).toEqual("((one And two) Until three)");
    });

    it("Create expression: (one And (two Until three))", function () {
        var b = _({name:'one'}).and()._({name:'two'}).until()._({name:'three'});
        var e = b.buildExpression();
        expect(e.toPrettyString()).toEqual("(one And (two Until three))");
    });

});