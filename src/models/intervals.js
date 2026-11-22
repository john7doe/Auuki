import { xf, exists, } from '../functions.js';
import { isoDate, } from '../utils.js';
import { DialogMsg, } from './enums.js';
import { LocalStorageItem } from '../storage/local-storage.js';

// Intervals.icu uses HTTP Basic auth: the username is the literal string
// "API_KEY" and the password is the athlete's personal API key (found under
// Settings -> Developer on intervals.icu). Athlete id 0 refers to the
// authenticated key owner. CORS is enabled, so the browser calls the API
// directly with no backend proxy.
const intervalsApi = 'https://intervals.icu/api/v1';
const intervalsAthleteId = '0';

function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function Intervals(args = {}) {
    const apiKeyStorage = LocalStorageItem({
        key: 'intervals-api-key',
        fallback: '',
    });

    let apiKey = apiKeyStorage.restore();

    function hasKey() {
        return exists(apiKey) && `${apiKey}`.trim() !== '';
    }

    function getKey() {
        return apiKey;
    }

    function headers(extra = {}) {
        return Object.assign(
            { 'Authorization': 'Basic ' + btoa(`API_KEY:${apiKey}`) },
            extra,
        );
    }

    function onNoAuth() {
        console.log(`:intervals :no-auth`);
        xf.dispatch('ui:modal:error:open', DialogMsg.noAuth);
    }

    // re-read the stored key and broadcast the connection state
    const update = function() {
        apiKey = apiKeyStorage.get();
        xf.dispatch('services', { intervals: hasKey() });
    };

    // String -> Void
    // store the user supplied API key and mark the service connected
    async function connect(key) {
        const value = `${key ?? ''}`.trim();
        if(value === '') {
            console.log(`:intervals :connect :no-key`);
            return;
        }
        apiKey = apiKeyStorage.set(value);
        console.log(`:intervals :connect`);
        xf.dispatch('services', { intervals: true });
    }

    // clear the stored API key and mark the service disconnected
    async function disconnect() {
        apiKeyStorage.remove();
        apiKey = '';
        console.log(`:intervals :disconnect`);
        xf.dispatch('services', { intervals: false });
    }

    async function uploadWorkout(record) {
        const blob = record.blob;
        const workoutName = record.summary?.name ?? 'Powered by Auuki workout';
        const url = `${intervalsApi}/athlete/${intervalsAthleteId}/activities`;

        if(!hasKey()) {
            onNoAuth();
            return ':fail';
        }

        const formData = new FormData();
        formData.append('file', blob);
        formData.append('name', workoutName);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers(),
                body: formData,
            });

            if(response.ok) {
                return ':success';
            } else {
                if(response.status === 401 || response.status === 403) {
                    onNoAuth();
                }
                return ':fail';
            }
        } catch(error) {
            console.log(error);
            return ':fail';
        }
    }

    // String, String -> [{id, start_date_local, workout_file_base64}]
    // Fetch planned workout events for the date range and download each as a
    // .zwo, preserving the base64 shape the planned model expects.
    async function wod(oldest = isoDate(), newest = isoDate()) {
        if(!hasKey()) {
            xf.dispatch('action:planned', ':intervals:wod:fail');
            onNoAuth();
            return [];
        }

        const url = `${intervalsApi}/athlete/${intervalsAthleteId}/events` +
              '?' +
              new URLSearchParams({
                  oldest,
                  newest,
                  category: 'WORKOUT',
              })
              .toString();

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: headers(),
            });

            if(response.ok) {
                const events = await response.json();
                const data = await eventsToWorkouts(events);
                xf.dispatch('action:planned', ':intervals:wod:success');
                return data;
            } else {
                xf.dispatch('action:planned', ':intervals:wod:fail');
                if(response.status === 401 || response.status === 403) {
                    onNoAuth();
                }
                return [];
            }
        } catch(error) {
            xf.dispatch('action:planned', ':intervals:wod:fail');
            console.log(error);
            return [];
        }
    }

    // [Event] -> [{id, start_date_local, workout_file_base64}]
    async function eventsToWorkouts(events = []) {
        const workouts = [];

        for(let event of events) {
            if(event.category !== 'WORKOUT') continue;

            const zwo = await downloadWorkout(event.id);
            if(!exists(zwo)) continue;

            workouts.push({
                id: event.id,
                start_date_local: event.start_date_local,
                workout_file_base64: utf8ToBase64(zwo),
            });
        }

        return workouts;
    }

    // Int -> String | undefined
    async function downloadWorkout(eventId) {
        const url =
              `${intervalsApi}/athlete/${intervalsAthleteId}/events/${eventId}/download.zwo`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: headers(),
            });

            if(!response.ok) return undefined;

            return await response.text();
        } catch(error) {
            console.log(error);
            return undefined;
        }
    }

    async function wodMock(oldest = isoDate(), newest = isoDate()) {
        const body = [{
            id: 47549572,
            start_date_local: `2026-03-03T00:00:00`,
            category: "WORKOUT",
            name: "Intervals.icu Threshold",
            indoor: true,
            workout_filename: "Intervals_icu_Threshold.zwo",
            workout_file_base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8d29ya291dF9maWxlPgogICAgPGF1dGhvcj5EaW1pdGFyIE1hcmlub3Y8L2F1dGhvcj4KICAgIDxuYW1lPkludGVydmFscy5pY3UgVGhyZXNob2xkPC9uYW1lPgogICAgPGRlc2NyaXB0aW9uPjwvZGVzY3JpcHRpb24+CiAgICA8c3BvcnRUeXBlPmJpa2U8L3Nwb3J0VHlwZT4KICAgIDx0YWdzLz4KICAgIDx3b3Jrb3V0PgogICAgICAgIDxXYXJtdXAgUG93ZXJIaWdoPSIwLjYyNyIgUG93ZXJMb3c9IjAuMzg5IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC42MjciIER1cmF0aW9uPSI2MCIvPgogICAgICAgIDxTdGVhZHlTdGF0ZSBzaG93X2F2Zz0iMSIgUG93ZXI9IjAuOTc4IiBEdXJhdGlvbj0iMzAiLz4KICAgICAgICA8U3RlYWR5U3RhdGUgc2hvd19hdmc9IjEiIFBvd2VyPSIwLjUiIER1cmF0aW9uPSIzMCIvPgogICAgICAgIDxTdGVhZHlTdGF0ZSBzaG93X2F2Zz0iMSIgUG93ZXI9IjAuOTc4IiBEdXJhdGlvbj0iMzAiLz4KICAgICAgICA8U3RlYWR5U3RhdGUgc2hvd19hdmc9IjEiIFBvd2VyPSIwLjUiIER1cmF0aW9uPSIzMCIvPgogICAgICAgIDxTdGVhZHlTdGF0ZSBzaG93X2F2Zz0iMSIgUG93ZXI9IjAuNTU5IiBEdXJhdGlvbj0iMTIwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPENvb2xkb3duIFBvd2VySGlnaD0iMC4zODkiIFBvd2VyTG93PSIwLjUiIER1cmF0aW9uPSIzMDAiLz4KICAgIDwvd29ya291dD4KPC93b3Jrb3V0X2ZpbGU+Cg==" }
                      ,
{
            id: 47549573,
            start_date_local: `2026-03-04T00:00:00`,
            category: "WORKOUT",
            name: "Intervals.icu Threshold",
            indoor: true,
            workout_filename: "Intervals_icu_Threshold.zwo",
            workout_file_base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8d29ya291dF9maWxlPgogICAgPGF1dGhvcj5EaW1pdGFyIE1hcmlub3Y8L2F1dGhvcj4KICAgIDxuYW1lPkludGVydmFscy5pY3UgVGhyZXNob2xkPC9uYW1lPgogICAgPGRlc2NyaXB0aW9uPjwvZGVzY3JpcHRpb24+CiAgICA8c3BvcnRUeXBlPmJpa2U8L3Nwb3J0VHlwZT4KICAgIDx0YWdzLz4KICAgIDx3b3Jrb3V0PgogICAgICAgIDxXYXJtdXAgUG93ZXJIaWdoPSIwLjYyNyIgUG93ZXJMb3c9IjAuMzg5IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC42MjciIER1cmF0aW9uPSI2MCIvPgogICAgICAgIDxTdGVhZHlTdGF0ZSBzaG93X2F2Zz0iMSIgUG93ZXI9IjAuOTc4IiBEdXJhdGlvbj0iMzAiLz4KICAgICAgICA8U3RlYWR5U3RhdGUgc2hvd19hdmc9IjEiIFBvd2VyPSIwLjUiIER1cmF0aW9uPSIzMCIvPgogICAgICAgIDxTdGVhZHlTdGF0ZSBzaG93X2F2Zz0iMSIgUG93ZXI9IjAuOTc4IiBEdXJhdGlvbj0iMzAiLz4KICAgICAgICA8U3RlYWR5U3RhdGUgc2hvd19hdmc9IjEiIFBvd2VyPSIwLjUiIER1cmF0aW9uPSIzMCIvPgogICAgICAgIDxTdGVhZHlTdGF0ZSBzaG93X2F2Zz0iMSIgUG93ZXI9IjAuNTU5IiBEdXJhdGlvbj0iMTIwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMS4wIiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPFN0ZWFkeVN0YXRlIHNob3dfYXZnPSIxIiBQb3dlcj0iMC41IiBEdXJhdGlvbj0iMzAwIi8+CiAgICAgICAgPENvb2xkb3duIFBvd2VySGlnaD0iMC4zODkiIFBvd2VyTG93PSIwLjUiIER1cmF0aW9uPSIzMDAiLz4KICAgIDwvd29ya291dD4KPC93b3Jrb3V0X2ZpbGU+Cg==" }
        ];

        return body;
    }


    // {
    //     weight: Int,
    //     icu_weight: Int,
    //     icu_weight_sync: String,
    //     sportSettings: [{
    //         types: [String],
    //         ftp: Int,
    //         indoor_ftp: Int,
    //         lthr: Int,
    //         max_hr: Int,
    //     }]
    // }
    // ->
    // { weight: Int, ftp: Int }
    function athleteToSettings(athlete = {}, defaults = {weight: 0, ftp: 0}) {
        const sportSettings = athlete.sportSettings ?? [];
        const weight = athlete.weight ?? athlete.icu_weight ?? defaults.weight;
        let ftp = defaults.ftp;

        let rideSetting;
        let virtualRideSetting;

        for(let sportSetting of sportSettings) {
            const types = sportSetting.types;

            for(let type of types) {
                if(type === "VirtualRide") {
                    virtualRideSetting = sportSetting;
                }
                if(type === "Ride") {
                    rideSetting = sportSetting;
                }
            }
        }

        if(virtualRideSetting) {
            ftp = virtualRideSetting.indoor_ftp ?? virtualRideSetting.ftp ?? defaults.ftp;
            return {weight, ftp};
        }
        if(rideSetting) {
            ftp = rideSetting.indoor_ftp ?? rideSetting.ftp ?? 0;
            return {weight, ftp};
        }

        return {weight, ftp};
    }

    async function getAthlete() {
        // GET /api/v1/athlete/{id}
        //
        // Weight is icu_weight (in kg).
        // The FTP is per sport (sportSettings array).
        // Search for one with types field containing ‘Ride’ or ‘VirtualRide’.
        // Then check ‘indoor_ftp’ (might be null) and ‘ftp’.
        // {
        //     weight: Int,
        //     icu_weight: Int,
        //     icu_weight_sync: String,
        //     sportSettings: [{
        //         types: [String]
        //         ftp: Int,
        //         indoor_ftp: Int,
        //         lthr: Int,
        //         max_hr: Int,
        //     }]
        // }
        const url = `${intervalsApi}/athlete/${intervalsAthleteId}`;

        if(!hasKey()) {
            xf.dispatch('action:athlete', ':intervals:athlete:fail');
            return athleteToSettings();
        }

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: headers(),
            });

            if(response.ok) {
                const data = await response.json();
                xf.dispatch('action:athlete', ':intervals:athlete:success');
                console.log(data);
                return athleteToSettings(data);
            } else {
                xf.dispatch('action:athlete', ':intervals:athlete:fail');
                if(response.status === 401 || response.status === 403) {
                    onNoAuth();
                }
                return athleteToSettings();
            }
        } catch(error) {
            xf.dispatch('action:athlete', ':intervals:athlete:fail');
            console.log(error);
            return athleteToSettings();
        }
    }

    return Object.freeze({
        connect,
        disconnect,
        uploadWorkout,
        update,
        wod,
        getAthlete,
        athleteToSettings,
        hasKey,
        getKey,

        wodMock,
    });
}

const intervals = Intervals();

export default intervals;

