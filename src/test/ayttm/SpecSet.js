describe( "Set tests", function () {

    var Item = function(name) {
        this.name = name;
    }
    Item.prototype.toString = function () {
        return this.name;
    };

    it("add and remove single item to set", function () {
        var set = new ayttm.Set();
        var item1 = new Item("one");
        expect(set.isEmpty()).toBeTruthy();
        set.add(item1);

        expect(set.isEmpty()).toBeFalsy();
        var item2 = set.item();

        expect(item1).toEqual(item2);
        set.remove(item1);

        expect(set.isEmpty()).toBeTruthy();
    });

    it("add set to set", function () {
        var set1 = new ayttm.Set().add(new Item("1")).add(new Item("2"));
        var set2 = new ayttm.Set().add(new Item("3")).add(new Item("4"));
        set1.addAll(set2);
        expect(set1.size()).toEqual(4);

        set1.removeAll(set2);
        expect(set1.size()).toEqual(2);

        expect(set1.equals(set1)).toBeTruthy();
        expect(set1.equals(set2)).toBeFalsy();
    });

    it("equality", function () {
        var set1 = new ayttm.Set().add(new Item("1")).add(new Item("2"));
        var set2 = new ayttm.Set().add(new Item("1")).add(new Item("2"));
        var set3 = new ayttm.Set().add(new Item("1"));

        expect(set1.equals(set2)).toBeTruthy();
        expect(set1.equals(set3)).toBeFalsy();
        expect(set3.equals(set1)).toBeFalsy();
    });

    it("Add value for key", function () {
        var set = new ayttm.Set();
        var key = "key -";
        var value = new Item(key);

        set.addValueForKey(key, value);
        expect(set.valueForKey(key)).toEqual(value);

        set.addValueForKey(key, null);
        expect(set.valueForKey(key)).toEqual(null);

    });

});