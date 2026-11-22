
class Config {
    #defaultStravaClientId = 0;
    #defaultIntervalsClientId = 0;
    #defaultTrainingPeaksClientId = 0;

    constructor() {
        this.env = {
            // PWA_URI: "http://localhost:1234",
            // API_URI: "http://localhost:8080",
            PWA_URI: window.location.origin ?? "https://auuki.com",
            // Same-origin managed API of the Static Web App (Azure Functions
            // under /api/*). Empty base => relative /api/* requests, so the
            // session cookie works without CORS. Use a localhost base above for
            // local dev against an external API.
            API_URI: "",
            // Public Cloudflare Turnstile site key. Build-time configurable via
            // the TURNSTILE_SITE_KEY env var (e.g. a Parcel .env file), falling
            // back to the default widget when unset.
            TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || "0x4AAAAAADivxD45Libwl9YF",
            STRAVA_CLIENT_ID: this.defaultStravaClientId,
            INTERVALS_CLIENT_ID: this.defaultIntervalsClientId,
            TRAINING_PEAKS_CLIENT_ID: this.defaultTrainingPeaksClientId,
        };
    }
    setServices(args = {}) {
        this.env.STRAVA_CLIENT_ID = args.strava ?? this.defaultStravaClientId;
        this.env.INTERVALS_CLIENT_ID = args.intervals ?? this.defaultIntervalsClientId;
        this.env.TRAINING_PEAKS_CLIENT_ID = args.trainingPeaks ?? this.defaultTrainingPeaksClientId;
    }
    get() {
        return this.env;
    }
}

const config = new Config();

export default config;
