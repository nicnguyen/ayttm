module ayttm {

    export class Map<V> {

        private map : {[id: string] : V} = {};

        public put(key : any, value : V) {
            this.map[key.toString()] = value;
            return this;
        }

        public remove(key : any) {
            delete this.map[key.toString()];
            return this;
        }

        public addValueForKey(key: any, value: V) {
            this.map[key.toString()] = value;
            return this;
        }

        public valueForKey(key : string) {
            return this.map[key];
        }

        public contains(key : any) {
            return this.map[key.toString()] !== undefined;
        }
    }
}