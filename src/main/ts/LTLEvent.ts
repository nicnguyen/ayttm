module ayttm {

    export interface LTLEvent {
        name : string;
        css? : string;
        source? : any;
        previousEvent? : any;
        otherPreviousEvent? : any;
    }

    export class LTLEvents {
        public static TimeoutEvent = { name : 'timeout' };
        public static TrueEvent = { name : 'true' };
        public static FalseEvent = { name : 'false' };

        public static isDOMEvent(event : LTLEvent) {
            return event.css !== undefined;
        }
    }
}