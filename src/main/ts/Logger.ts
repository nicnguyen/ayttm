module ayttm {

    export enum LogLevel {
        vortex,
        debug,
        info,
        error
    }

    export class Logger {

        public static level = LogLevel.vortex;

        private static logStringAtLevel(s : any, l : LogLevel) {
            if (l <= Logger.level) {
                if (typeof s.toPrettyString === "function") {
                    console.log(s.toPrettyString());
                } else {
                    console.log(s.toString());
                }
            }
        }

        public static debug(s:any) {
            Logger.logStringAtLevel(s, LogLevel.debug);
        }

        public static info(s:any) {
            Logger.logStringAtLevel(s, LogLevel.info);
        }

        public static error(s:any) {
            Logger.logStringAtLevel(s, LogLevel.error);
        }
    }
}