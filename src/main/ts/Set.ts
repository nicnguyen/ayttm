module ayttm {

    export class Set<V> {

        private map : {[id: string] : V} = {};

        public add(value : V) {
            this.map[value.toString()] = value;
            return this;
        }

        public remove(value : V) {
            delete this.map[value.toString()];
            return this;
        }

        public equals(other : Set<V>) {
            for (var property in other.map) {
                if (!this.map[property]) {
                    return false;
                }
            }

            for (var property in this.map) {
                if (!other.map[property]) {
                    return false;
                }
            }
            return true;
        }

        public addAll(other : Set<V>) {
            for (var id in other.map) {
                this.add(other.map[id]);
            }
            return this;
        }

        public removeAll(other : Set<V>) {
            for (var id in other.map) {
                this.remove(other.map[id]);
            }
            return this;
        }

        public clear() {
            for (var id in this.map) {
                this.remove(this.map[id]);
            }
            return this;
        }

        public isEmpty() {
            return Object.keys(this.map).length == 0;
        }

        public addValueForKey(key: string, value: V) {
            this.map[key] = value;
            return this;
        }

        public clone() {
            var newSet = new Set<V>();
            newSet.addAll(this);
            return newSet;
        }

        public item() {
            if (!this.isEmpty()) {
                return this.map[Object.keys(this.map)[0]];
            }
            return null;
        }

        public size() {
           return Object.keys(this.map).length;
        }

        public static fromArray<V>(array : V[]) {
            var set = new Set<V>();
            for (var i =0; i < array.length; ++i) {
                set.add(array[i]);
            }
            return set;
        }

        public static singleton<V>(item : V) {
            return new Set<V>().add(item);
        }

        public static empty<V>() {
            return new Set<V>();
        }

        public filter(predicate : (V) => boolean) {
            var filtered = Set.empty<V>();
            for (var id in this.map) {
                if (predicate(this.map[id])) {
                    filtered.add(this.map[id]);
                }
            }
            return filtered;
        }

        public filterOne(predicate : (V) => boolean) {
            return this.filter(predicate).item();
        }

        public toArray() {
            var array : Array<V> = [];
            for (var property in this.map) {
                array.push(this.map[property]);
            }
            return array;
        }

        public valueForKey(key : string) {
            return this.map[key];
        }

        public contains(value : V) {
            return this.map[value.toString()] !== undefined;
        }

        public intersects(other : Set<V>) : boolean {
            for (var property in this.map) {
                if (other.map[property]) {
                    return true;
                }
            }
            return false;
        }
    }
}