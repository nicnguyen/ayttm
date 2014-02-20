/// <reference path="set.ts"/>

module ayttm {

    export class GraphNode {

        private static counter : number = 0;
        public static initialNodeName = 'init';
        public final = false;

        public static initialNode(){
            return new GraphNode(
                GraphNode.initialNodeName,
                Set.empty<GraphNode>(),
                Set.empty<Expression>(),
                Set.empty<Expression>(),
                Set.empty<Expression>()
                );
        }

        constructor (
            public name : string,
            public incomingNodes : Set<GraphNode>,
            public newExpressions : Set<Expression>,
            public oldExpressions : Set<Expression>,
            public nextExpressions : Set<Expression>
        ) {

        }

        public static newName() {
            GraphNode.counter = GraphNode.counter + 1;
            return "Node_" + GraphNode.counter.toString();
        }

        public toString() {return this.name;}

        public toPrettyString() {
            return "{ name: "  + this.name + ", incoming : {" + this.incomingNodes.toArray().map(node => node.name).join(", ") + "}" + " }";
        }

        public static resetCounter(){
            GraphNode.counter = 0;
        }
    }
}
