import { equals, existance, exists,
         empty, first, last, repeat,
         capitalize, toFixed } from '../functions.js';

// TODO: replace with ParserCombinators.js implementation
// - allow for wrong xml syntax

function readAttribute(args = {}) {
    const el       = args.el;
    const name     = args.name;
    const decode   = existance(args.decode, ((x) => x));

    if(el.hasAttribute(name)) {
        return decode(el.getAttribute(name));
    } else {
        return undefined;
    }
}

function writeAttribute(args = {}) {
    const encode = existance(args.encode, ((x) => x));
    const name   = existance(args.name);
    const value  = existance(args.value);

    return `${name}="${encode(value)}"`;
}

function Attribute(args = {}) {
    const defaults = {
        name:      '',
        decode:    ((x) => x),
    };

    const name   = existance(args.name, defaults.name);
    const decode = existance(args.decode, defaults.decode);
    const encode = existance(args.encode, decode);

    function getName() {
        return name;
    }

    function read(args = {}) {
        const el = existance(args.el);
        return readAttribute({el, name, decode});
    }

    function write(args = {}) {
        const value = existance(args.value);
        return writeAttribute({name, value, encode});
    }

    return Object.freeze({
        getName,
        read,
        write,
    });
}

function attributesToStep(args = {}) {
    const tag    = existance(args.element);
    const filter = existance(args.filter, ((_) => true));
    const toName = existance(args.toName, ((x) => x));

    return Object.keys(tag).reduce(function(acc, key) {
        if(filter(key) && exists(tag[key])) {
            const name  = toName(key);
            const value = tag[key];
            acc[name] = value;
        }
        return acc;
    }, {});
}

function readTextEvents(el) {
    if(!exists(el) || !exists(el.children)) return [];

    const out = [];
    const children = el.children;

    for(let i = 0; i < children.length; i++) {
        const child = children[i];
        if(child.tagName && child.tagName.toLowerCase() === 'textevent') {
            const rawOffset = child.getAttribute('timeoffset');
            const rawLoc    = child.getAttribute('locIndex');
            const message   = child.getAttribute('message');

            const timeoffset = parseInt(rawOffset);
            const locIndex   = rawLoc === null ? undefined : parseInt(rawLoc);

            if(isNaN(timeoffset) || !exists(message)) continue;

            const ev = {timeoffset, message};
            if(exists(locIndex) && !isNaN(locIndex)) ev.locIndex = locIndex;
            out.push(ev);
        }
    }

    return out;
}

function withTextEvents(interval, element) {
    if(exists(element.textevents) && !empty(element.textevents)) {
        interval.textevents = element.textevents;
    }
    return interval;
}

function Step(element) {
    const spec = {
        element: element,
        filter:  (key) => !equals(key, 'element') && !equals(key, 'textevents'),
        toName:  (key) => key.toLowerCase(),
    };

    return attributesToStep(spec);
}

function OnStep(element) {
    const spec = {
        element:    element,
        filter: (key) => key.startsWith('On') || equals(key, 'Cadence'),
        toName: (key) => key.replace(/On/g,'').toLocaleLowerCase(),
    };

    return attributesToStep(spec);
}

function OffStep(element) {
    const spec = {
        element:    element,
        filter: (key) => key.startsWith('Off') || key.endsWith('Resting'),
        toName: (key) => key.replace(/On|Off|Resting/g,'').toLocaleLowerCase(),
    };

    return attributesToStep(spec);
}

function Element(args = {}) {
    const defaults = {
        name:     'Unknown',
        tagOpen:  '<Unknown',
        tagClose: ' />',
        content:  '',
    };

    const name         = existance(args.name, defaults.name);
    const tagOpen      = existance(args.tagOpen, defaults.tagOpen);
    const tagClose     = existance(args.tagClose, defaults.tagClose);
    const toInterval   = existance(args.toInterval, defaultToInterval);
    const fromInterval = existance(args.fromInterval, defaultFromInterval);
    const calcDuration = existance(args.calcDuration, defaultCalcDuration);

    function getName() {
        return name;
    }

    function readContent(el) {
        if(exists(el)) {
            let value = el.textContent;
            if(empty(value)) {
                return undefined;
            } else {
                return value;
            }
        }

        return undefined;
    }

    function read(args = {}) {
        const el            = existance(args.el);
        const attrsNodeList = el.attributes || [];
        const length        = attrsNodeList.length;

        let acc = {element: name};

        for(let i = 0; i < length; i++) {
            const name   = attrsNodeList[i].name;
            const attrFn = Attrs[name];
            const key    = name;
            let value    = attrsNodeList[i].value;

            if(exists(attrFn)) {
                value = attrFn.read({el});
            }

            acc[key] = value;
        }

        const textevents = readTextEvents(el);
        if(!empty(textevents)) {
            acc.textevents = textevents;
        }

        return acc;
    }

    function write(args = {}) {
        let { content, textevents, ...attributes } = args;

        content = existance(args.content, defaults.content);

        const attrsString = Object.keys(attributes).reduce((acc, key) => {
            acc += ` ${key}="${attributes[key]}"`;
            return acc;
        }, '');

        return `${tagOpen + attrsString}${content}${tagClose}`;
    }

    function defaultCalcDuration(element) {
        const duration = element.Duration;
        return duration;
    }

    function defaultToInterval(element) {
        const duration = calcDuration(element);
        const step = Step(element);

        return withTextEvents({
            duration: duration,
            steps:    [step],
        }, element);
    }

    function defaultFromInterval(interval) {
        const res = {
            element: name,
            Duration: interval.duration,
        };
        const step = first(interval.steps);

        if(exists(step.power)) res.Power = step.power;
        if(exists(step.cadence)) res.Cadence = step.cadence;
        if(exists(step.slope)) res.Slope = step.slope;

        return res;
    }

    function readToInterval(args = {}) {
        return toInterval(read(args));
    }

    function writeFromInterval(args = {}) {
        return fromInterval(write(args));
    }

    return Object.freeze({
        getName,
        readContent,
        read,
        write,
        toInterval,
        fromInterval,
        calcDuration,
        defaultCalcDuration,
        defaultToInterval,
        readToInterval,
        defaultFromInterval,
        writeFromInterval,
    });
}

function IntervalsT(args = {}) {
    const spec = {
        name:         'IntervalsT',
        tagOpen:      '<IntervalsT',
        tagClose:     ' />',
        toInterval:   toInterval,
        calcDuration: calcDuration,
    };

    function calcDuration(element) {
        return element.Repeat * (element.OnDuration + element.OffDuration);
    }

    function toInterval(element) {
        const duration   = calcDuration(element);
        const stepsCount = existance(element.Repeat, 1);

        const onStep  = OnStep(element);
        const offStep = OffStep(element);
        const steps   = repeat(stepsCount)(function(acc) {
            acc.push({duration: onStep.duration, steps: [onStep]});
            acc.push({duration: offStep.duration, steps: [offStep]});
            return acc;
        })([]);

        distributeTextEvents(steps, element.textevents);

        return steps;
    }

    function distributeTextEvents(subIntervals, textevents) {
        if(!exists(textevents) || empty(textevents)) return;
        if(empty(subIntervals)) return;

        const starts = [];
        let cumulative = 0;
        for(let i = 0; i < subIntervals.length; i++) {
            starts.push(cumulative);
            cumulative += subIntervals[i].duration;
        }
        const totalDuration = cumulative;

        for(const ev of textevents) {
            const t = ev.timeoffset;
            let idx;

            if(t < 0) {
                idx = 0;
            } else if(t >= totalDuration) {
                idx = subIntervals.length - 1;
            } else {
                idx = 0;
                for(let i = 0; i < subIntervals.length; i++) {
                    if(t >= starts[i] && t < starts[i] + subIntervals[i].duration) {
                        idx = i;
                        break;
                    }
                }
            }

            const local = Math.max(0, t - starts[idx]);
            const localEv = {timeoffset: local, message: ev.message};
            if(exists(ev.locIndex)) localEv.locIndex = ev.locIndex;

            if(!exists(subIntervals[idx].textevents)) {
                subIntervals[idx].textevents = [];
            }
            subIntervals[idx].textevents.push(localEv);
        }
    }

    return Element(spec);
}

function Unknown(args = {}) {
    const spec = {
        name:     'Unknown',
        tagOpen:  '<Unknown',
        tagClose: ' />',
    };

    // console.warn(`Unknown Element in .zwo workout: ${args.el}`);

    return Element(spec);
}

function FreeRide(args = {}) {
    const spec = {
        name:     'FreeRide',
        tagOpen:  '<FreeRide',
        tagClose: ' />',
        toInterval: toInterval,
    };

    function toInterval(element) {
        let duration   = existance(element.Duration, 1);
        const sim      = element.Sim;
        const track    = element.Track;
        const power    = 0;
        const slope    = 0;
        const steps    = [];

        let simDuration   = 0;
        let trackDistance = 0;

        if(exists(sim)) {
            for(let i=0; i< sim.length; i+=2) {
                simDuration += sim[i+1];
                steps.push({duration: sim[i+1], slope: sim[i], power});
            }
            if(simDuration < duration) {
                steps.push({duration: (duration - simDuration), slope, power});
            }
            if(simDuration > duration) {
                duration = simDuration;
            }
        } else if(exists(track)) {
            for(let i=0; i< track.length; i+=2) {
                trackDistance += track[i+1];
                steps.push({distance: track[i+1], slope: track[i], power});
            }
        } else {
            steps.push({duration, slope, power});
        }

        if(exists(track)) {
            return withTextEvents({distance: trackDistance, steps: steps}, element);
        }

        return withTextEvents({
            duration: duration,
            steps: steps,
        }, element);

    }

    return Element(spec);
}

function Warmup(args = {}) {
    const defaults = {
        timeDx: 10,
    };

    const timeDx = existance(args.timeDx, defaults.timeDx);

    const spec = Object.assign({
        name:         'Warmup',
        tagOpen:      '<Warmup',
        tagClose:     ' />',
        toInterval:   toInterval,
        fromInterval: fromInterval,
    }, args.spec);

    function toInterval(element) {
        const duration    = element.Duration;
        const powerLow    = element.PowerLow ?? element.Power;
        const powerHigh   = element.PowerHigh ?? element.Power;
        const cadence     = element.Cadence;
        const cadenceLow  = element.CadenceLow;
        const cadenceHigh = element.CadenceHigh;

        const stepsCount = parseInt(duration / timeDx);
        const powerDx    = (powerHigh - powerLow) / (stepsCount - 1);
        const cadenceDx  = (cadenceHigh - cadenceLow) / (stepsCount - 1);

        let steps       = [];
        let stepPower   = powerLow;
        let stepCadence = cadenceLow;

        for(let i = 0; i < stepsCount; i++) {
            if(exists(cadenceLow) && exists(cadenceHigh)) {
                steps.push({duration: timeDx, power: stepPower, cadence: Math.round(stepCadence),});
                stepCadence = (stepCadence + cadenceDx);
            } else if(exists(cadence)) {
                steps.push({duration: timeDx, power: stepPower, cadence,});
            } else {
                steps.push({duration: timeDx, power: stepPower});
            }
            stepPower = (stepPower + powerDx);
        }

        const fixedSteps = steps.map((step) => {
            step.power = toFixed(step.power, 2);
            return step;
        });

        return withTextEvents({
            duration: duration,
            steps: fixedSteps,
        }, element);
    }

    function fromInterval(interval) {
        const res = {
            element:  spec.name,
            Duration: interval.duration,
        };
        const start = first(interval.steps);
        const end   = last(interval.steps);

        if(exists(start.power)) res.PowerLow = start.power;
        if(exists(end.power))   res.PowerHigh = end.power;

        return res;
    }

    return Element(spec);
}

function Cooldown(args = {}) {
    const defaults = {
        timeDx: 10,
    };

    const timeDx = existance(args.timeDx, defaults.timeDx);

    const spec = {
        name:         'Cooldown',
        tagOpen:      '<Cooldown',
        tagClose:     ' />',
        toInterval:   toInterval,
        fromInterval: fromInterval,
    };

    function toInterval(element) {
        const duration  = element.Duration;
        const powerLow  = element.PowerHigh;
        const powerHigh = element.PowerLow;

        const stepsCount = parseInt(duration / timeDx);
        const powerDx    = (powerHigh - powerLow) / (stepsCount - 1);

        let steps     = [];
        let stepPower = powerHigh;

        for(let i = 0; i < stepsCount; i++) {
            steps.push({duration: timeDx, power: stepPower});
            stepPower = (stepPower - powerDx);
        }

        const fixedSteps = steps.map((step) => {
            step.power = toFixed(step.power, 2);
            return step;
        });

        return withTextEvents({
            duration: duration,
            steps: fixedSteps,
        }, element);
    }

    function fromInterval(interval) {
        const res = {
            element:  spec.name,
            Duration: interval.duration,
        };
        const start = first(interval.steps);
        const end   = last(interval.steps);

        if(exists(start.power)) res.PowerLow = start.power;
        if(exists(end.power))   res.PowerHigh  = end.power;

        return res;
    }

    return Element(spec);
}

function Ramp(args = {}) {
    const spec = {
        name:       'Ramp',
        tagOpen:    '<Ramp',
        tagClose:   ' />',
    };

    return Warmup(spec);
}

function SteadyState(args = {}) {

    const spec = Object.assign({
        name:         'SteadyState',
        tagOpen:      '<SteadyState',
        tagClose:     ' />',
        toInterval:   toInterval,
    }, args.spec);

    function toInterval(element) {
        const duration  = element.Duration;
        const power     = element.Power;
        const powerLow  = element.PowerLow;
        const powerHigh = element.PowerHigh;
        const cadence     = element.Cadence;
        const cadenceLow  = element.CadenceLow;
        const cadenceHigh = element.CadenceHigh;

        if(!exists(cadence) && (exists(cadenceLow) || exists(cadenceHigh))) {
            const avgCadence = [cadenceLow, cadenceHigh]
                .filter(exists)
                .reduce((acc, x, _, { length }) => acc + x / length, 0);
            element.Cadence = Math.round(avgCadence);
            element.CadenceLow = undefined;
            element.CadenceHigh = undefined;
        }

        let step = {};

        if(exists(power)) {
            step = Step(element);
        }
        else if(exists(powerLow) || exists(powerHigh)) {
            element.Power = [powerLow, powerHigh]
                .filter(exists)
                .reduce((acc, x, _, { length }) => acc + x / length, 0);
            element.PowerLow = undefined;
            element.PowerHigh = undefined;
            step = Step(element);
        }
        else {
            element.Power = 0;
            element.Slope = 0;
            step = Step(element);
        }

        return withTextEvents({
            duration: duration,
            steps: [step],
        }, element);
    }

    return Element(spec);
}

function readContent(el) {
    if(exists(el)) {
        let value = el.textContent;
        if(empty(value)) {
            return undefined;
        } else {
            return value;
        }
    }
    return undefined;
}

function Head(args = {}) {
    const defaults = {
        author:      'Unknown',
        name:        'Custom',
        description: 'Custom',
        category:    'Custom',
        subcategory: '',
        sportType:   'bike',
        tags:        '',
    };

    function read(args = {}) {
        const doc = existance(args.doc);

        const author      = readContent(doc.querySelector('author'));
        const name        = readContent(doc.querySelector('name'));
        const description = readContent(doc.querySelector('description'));
        const category    = readContent(doc.querySelector('category'));
        const subcategory = readContent(doc.querySelector('subcategory'));
        const sportType   = readContent(doc.querySelector('sportType'));

        return {
            author:      existance(author, defaults.author),
            name:        existance(name, defaults.name),
            description: existance(description, defaults.description),
            category:    existance(category, defaults.category),
            subcategory: existance(subcategory, defaults.subcategory),
            sportType:   existance(sportType, defaults.sportType),
        };
    }

    function write(args = {}) {
        const author      = existance(args.author, defaults.author);
        const name        = existance(args.name, defaults.name);
        const description = existance(args.description, defaults.description);
        const sportType   = existance(args.sportType, defaults.sportType);
        const category    = existance(args.category, defaults.category);
        const subcategory = existance(args.subcategory, defaults.subcategory);
        const tags        = existance(args.tags, defaults.tags);

        const elements = [
            Elements.Author.write({content: author}),
            Elements.Name.write({content: name}),
            Elements.Category.write({content: category}),
            Elements.SubCategory.write({content: subcategory}),
            Elements.Description.write({content: description}),
            Elements.SportType.write({content: sportType}),
            Elements.Tags.write({content: tags}),
        ];

        return elements.reduce((acc, el) => acc + el.padStart(el.length+4, ' ') + '\n', '\n');
    }

    function fromInterval(intervals) {
        return {
            author: intervals.meta.author,
            name: intervals.meta.name,
            category: intervals.meta.category,
            subcategory: intervals.meta.subcategory,
            sportType: intervals.meta.sportType,
            description: intervals.meta.description,
        };
    }

    return Object.freeze({
        read,
        write,
        fromInterval,
    });
}

function Body() {
    const defaults = {
        parent: 'workout',
    };

    const parent = defaults.parent;

    function apply(el, method = 'read') {
        const name = el.tagName;

        if(exists(Elements[name])) {
            return Elements[name][method]({el});
        }

        return Elements.Unknown[method]({el});
    }

    function queryElements(doc) {
        const workoutEl = doc.querySelector(parent);
        const elements  = Array.from(workoutEl.children);
        return elements;
    }

    function read(args = {}) {
        const doc = existance(args.doc);
        const elements = queryElements(doc);
        return elements.map((el) => apply(el, 'read'), []);
    }

    function readToInterval(args = {}) {
        const doc = existance(args.doc);
        const elements = queryElements(doc);
        return elements.flatMap((el) => apply(el, 'readToInterval'), []);
    }

    function writeElement(args = {}) {
        const { element, ...spec } = args;

        if(exists(Elements[element])) {
            return Elements[element].write(spec);
        }

        return Elements.Unknown.write(spec);
    }

    function isRamp(steps) {
        return steps.length > 1;
    }
    function isRampUp(steps) {
        return first(steps).power < last(steps).power;
    }
    function isRampDown(steps) {
        return first(steps).power > last(steps).power;
    }

    function fromInterval(value) {
        const intervals = value.intervals;
        const acc = [];

        for(var i = 0; i < intervals.length; i++) {
            var interval = intervals[i];
            var steps = intervals[i].steps;
            var node = {};

            if(isRamp(steps)) {
                if(isRampUp(steps)) {
                    node = Elements.Warmup.fromInterval(interval);
                } else
                if(isRampDown(steps)) {
                    node = Elements.Cooldown.fromInterval(interval);
                }
            } else {
                node = Elements.SteadyState.fromInterval(interval);
            }

            acc.push(node);
        }

        return acc;
    }

    function writeElements(elements) {
        return elements.reduce((acc, element) => {
            const row = writeElement(element);
            acc += row.padStart(row.length+8, ' ') + '\n';
            return acc;
        }, '');
    }

    function write(args = {}) {
        return `<workout>\n${writeElements(args)}    </workout>`;
    }

    return Object.freeze({
        read,
        readToInterval,
        fromInterval,
        write,
    });
}

function encodeSim(arr) {
    return arr.join(',');
}

function decodeSim(str) {
    return str.split(',').reduce((acc, x) => {
        const n = parseFloat(x);
        if(!isNaN(n)) acc.push(n);
        return acc;
    }, []);
}

const Attrs = {
    Duration:    Attribute({name: 'Duration', decode: parseInt}),
    OnDuration:  Attribute({name: 'OnDuration', decode: parseInt}),
    OffDuration: Attribute({name: 'OffDuration', decode: parseInt}),
    Power:     Attribute({name: 'Power', decode: parseFloat}),
    OnPower:   Attribute({name: 'OnPower', decode: parseFloat}),
    OffPower:  Attribute({name: 'OffPower', decode: parseFloat}),
    PowerLow:  Attribute({name: 'PowerLow', decode: parseFloat}),
    PowerHigh: Attribute({name: 'PowerHigh', decode: parseFloat}),

    Cadence:        Attribute({name: 'Cadence', decode: parseInt}),
    CadenceLow:     Attribute({name: 'CadenceLow', decode: parseInt}),
    CadenceHigh:    Attribute({name: 'CadenceHigh', decode: parseInt}),
    CadenceResting: Attribute({name: 'CadenceResting', decode: parseInt}),

    Slope:     Attribute({name: 'Slope', decode: parseFloat}),
    OnSlope:   Attribute({name: 'OnSlope', decode: parseFloat}),
    OffSlope:  Attribute({name: 'OffSlope', decode: parseFloat}),
    SlopeLow:  Attribute({name: 'SlopeLow', decode: parseFloat}),
    SlopeHigh: Attribute({name: 'SlopeHigh', decode: parseFloat}),

    Distance: Attribute({name: 'Distance', decode: parseInt}),

    Sim:   Attribute({name: 'Sim', decode: decodeSim, encode: encodeSim}),
    Track: Attribute({name: 'Track', decode: decodeSim, encode: encodeSim}),

    Repeat: Attribute({name: 'Repeat', decode: parseInt}),
};

const Elements = {
    Warmup:      Warmup(),
    // SteadyState: Element({name: 'SteadyState', tagOpen: '<SteadyState', tagClose: ' />'}),
    SteadyState: SteadyState(),
    IntervalsT:  IntervalsT(),
    FreeRide:    FreeRide(),
    Ramp:        Ramp(),
    Cooldown:    Cooldown(),
    Unknown:     Unknown(),
    Author:      Element({name: 'author', tagOpen: '<author>', tagClose: '</author>'}),
    Name:        Element({name: 'name', tagOpen: '<name>', tagClose: '</name>'}),
    Category:    Element({name: 'category', tagOpen:  '<category>', tagClose: '</category>'}),
    SubCategory: Element({name: 'subcategory', tagOpen:  '<subcategory>', tagClose: '</subcategory>'}),
    Description: Element({name: 'description', tagOpen: '<description>', tagClose: '</description>'}),
    SportType:   Element({name: 'sporttype', tagOpen:  '<sporttype>', tagClose: '</sporttype>'}),
    Tags:        Element({name: 'tags', tagOpen: '<tags>', tagClose: '</tags>'}),
};

const head = Head();
const body = Body();

const parser    = new DOMParser();

function readToInterval(zwo) {
    const doc       = parser.parseFromString(zwo, 'text/xml');
    const meta      = head.read({doc});
    const intervals = body.readToInterval({doc});
    const duration  = intervals.reduce((acc, i) => acc + i.duration, 0);

    return {
        meta:      Object.assign(meta, {duration}),
        intervals: intervals,
    };
}

function read(zwo) {
    const doc          = parser.parseFromString(zwo, 'text/xml');
    const headElements = head.read({doc});
    const bodyElements = body.read({doc});

    return {
        head: headElements,
        body: bodyElements,
    };
}

function fromInterval(intervals) {
    const res = {
        head: head.fromInterval(intervals),
        body: body.fromInterval(intervals),
    };

    return res;
}

function write(args = {}) {
    const headElements = head.write(args.head);
    const bodyElements = body.write(args.body);

    return `<workout_file>${headElements}    ${bodyElements}\n</workout_file>`;
}

const zwo = {
    readAttribute,
    writeAttribute,
    Attribute,
    Attrs,
    Element,
    Elements,

    attributesToStep,
    Step,
    OnStep,
    OffStep,

    head,
    body,
    readToInterval,
    read,
    fromInterval,
    write,
};

export { zwo };

