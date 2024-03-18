function _extends() {
    _extends = Object.assign ? Object.assign.bind() : function (target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
        }
        return target;
    };
    return _extends.apply(this, arguments);
}

var State;
(function (State) {
    State[State["New"] = 0] = "New";
    State[State["Learning"] = 1] = "Learning";
    State[State["Review"] = 2] = "Review";
    State[State["Relearning"] = 3] = "Relearning";
})(State || (State = {}));
var Rating;
(function (Rating) {
    Rating[Rating["Again"] = 1] = "Again";
    Rating[Rating["Hard"] = 2] = "Hard";
    Rating[Rating["Good"] = 3] = "Good";
    Rating[Rating["Easy"] = 4] = "Easy";
})(Rating || (Rating = {}));
var ReviewLog = function ReviewLog(rating, scheduled_days, elapsed_days, review, state) {
    this.rating = rating;
    this.elapsed_days = elapsed_days;
    this.scheduled_days = scheduled_days;
    this.review = review;
    this.state = state;
};
var Card = function Card() {
    this.due = new Date();
    this.stability = 0;
    this.difficulty = 0;
    this.elapsed_days = 0;
    this.scheduled_days = 0;
    this.reps = 0;
    this.lapses = 0;
    this.state = State.New;
    this.last_review = new Date();
};
var SchedulingInfo = function SchedulingInfo(card, review_log) {
    this.card = card;
    this.review_log = review_log;
};
var SchedulingCards = /*#__PURE__*/function () {
    function SchedulingCards(card) {
        this.again = _extends({}, card);
        this.hard = _extends({}, card);
        this.good = _extends({}, card);
        this.easy = _extends({}, card);
    }
    var _proto = SchedulingCards.prototype;
    _proto.update_state = function update_state(state) {
        if (state === State.New) {
            this.again.state = State.Learning;
            this.hard.state = State.Learning;
            this.good.state = State.Learning;
            this.easy.state = State.Review;
        } else if (state === State.Learning || state === State.Relearning) {
            this.again.state = state;
            this.hard.state = state;
            this.good.state = State.Review;
            this.easy.state = State.Review;
        } else if (state === State.Review) {
            this.again.state = State.Relearning;
            this.hard.state = State.Review;
            this.good.state = State.Review;
            this.easy.state = State.Review;
            this.again.lapses += 1;
        }
    };
    _proto.schedule = function schedule(now, hard_interval, good_interval, easy_interval) {
        this.again.scheduled_days = 0;
        this.hard.scheduled_days = hard_interval;
        this.good.scheduled_days = good_interval;
        this.easy.scheduled_days = easy_interval;
        this.again.due = new Date(now.getTime() + 5 * 60 * 1000);
        if (hard_interval > 0) {
            this.hard.due = new Date(now.getTime() + hard_interval * 24 * 60 * 60 * 1000);
        } else {
            this.hard.due = new Date(now.getTime() + 10 * 60 * 1000);
        }
        this.good.due = new Date(now.getTime() + good_interval * 24 * 60 * 60 * 1000);
        this.easy.due = new Date(now.getTime() + easy_interval * 24 * 60 * 60 * 1000);
    };
    _proto.record_log = function record_log(card, now) {
        var _ref;
        return _ref = {}, _ref[Rating.Again] = new SchedulingInfo(this.again, new ReviewLog(Rating.Again, this.again.scheduled_days, card.elapsed_days, now, card.state)), _ref[Rating.Hard] = new SchedulingInfo(this.hard, new ReviewLog(Rating.Hard, this.hard.scheduled_days, card.elapsed_days, now, card.state)), _ref[Rating.Good] = new SchedulingInfo(this.good, new ReviewLog(Rating.Good, this.good.scheduled_days, card.elapsed_days, now, card.state)), _ref[Rating.Easy] = new SchedulingInfo(this.easy, new ReviewLog(Rating.Easy, this.easy.scheduled_days, card.elapsed_days, now, card.state)), _ref;
    };
    return SchedulingCards;
}();
var Params = function Params() {
    this.request_retention = 0.9;
    this.maximum_interval = 36500;
    this.w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
};
var FSRS = /*#__PURE__*/function () {
    function FSRS() {
        this.p = new Params();
    }
    var _proto2 = FSRS.prototype;
    _proto2.repeat = function repeat(card, now) {
        card = _extends({}, card);
        if (card.state === State.New) {
            card.elapsed_days = 0;
        } else {
            card.elapsed_days = (now.getTime() - card.last_review.getTime()) / 86400000;
        }
        card.last_review = now;
        card.reps += 1;
        var s = new SchedulingCards(card);
        s.update_state(card.state);
        if (card.state === State.New) {
            this.init_ds(s);
            s.again.due = new Date(now.getTime() + 60 * 1000);
            s.hard.due = new Date(now.getTime() + 5 * 60 * 1000);
            s.good.due = new Date(now.getTime() + 10 * 60 * 1000);
            var easy_interval = this.next_interval(s.easy.stability);
            s.easy.scheduled_days = easy_interval;
            s.easy.due = new Date(now.getTime() + easy_interval * 24 * 60 * 60 * 1000);
        } else if (card.state === State.Learning || card.state === State.Relearning) {
            var hard_interval = 0;
            var good_interval = this.next_interval(s.good.stability);
            var _easy_interval = Math.max(this.next_interval(s.easy.stability), good_interval + 1);
            s.schedule(now, hard_interval, good_interval, _easy_interval);
        } else if (card.state === State.Review) {
            var interval = card.elapsed_days;
            var last_d = card.difficulty;
            var last_s = card.stability;
            var retrievability = Math.pow(1 + interval / (9 * last_s), -1);
            this.next_ds(s, last_d, last_s, retrievability);
            var _hard_interval = this.next_interval(s.hard.stability);
            var _good_interval = this.next_interval(s.good.stability);
            _hard_interval = Math.min(_hard_interval, _good_interval);
            _good_interval = Math.max(_good_interval, _hard_interval + 1);
            var _easy_interval2 = Math.max(this.next_interval(s.easy.stability), _good_interval + 1);
            s.schedule(now, _hard_interval, _good_interval, _easy_interval2);
        }
        return s.record_log(card, now);
    };
    _proto2.init_ds = function init_ds(s) {
        s.again.difficulty = this.init_difficulty(Rating.Again);
        s.again.stability = this.init_stability(Rating.Again);
        s.hard.difficulty = this.init_difficulty(Rating.Hard);
        s.hard.stability = this.init_stability(Rating.Hard);
        s.good.difficulty = this.init_difficulty(Rating.Good);
        s.good.stability = this.init_stability(Rating.Good);
        s.easy.difficulty = this.init_difficulty(Rating.Easy);
        s.easy.stability = this.init_stability(Rating.Easy);
    };
    _proto2.next_ds = function next_ds(s, last_d, last_s, retrievability) {
        s.again.difficulty = this.next_difficulty(last_d, Rating.Again);
        s.again.stability = this.next_forget_stability(last_d, last_s, retrievability);
        s.hard.difficulty = this.next_difficulty(last_d, Rating.Hard);
        s.hard.stability = this.next_recall_stability(last_d, last_s, retrievability, Rating.Hard);
        s.good.difficulty = this.next_difficulty(last_d, Rating.Good);
        s.good.stability = this.next_recall_stability(last_d, last_s, retrievability, Rating.Good);
        s.easy.difficulty = this.next_difficulty(last_d, Rating.Easy);
        s.easy.stability = this.next_recall_stability(last_d, last_s, retrievability, Rating.Easy);
    };
    _proto2.init_stability = function init_stability(r) {
        return Math.max(this.p.w[r - 1], 0.1);
    };
    _proto2.init_difficulty = function init_difficulty(r) {
        return Math.min(Math.max(this.p.w[4] - this.p.w[5] * (r - 3), 1), 10);
    };
    _proto2.next_interval = function next_interval(s) {
        var interval = s * 9 * (1 / this.p.request_retention - 1);
        return Math.min(Math.max(Math.round(interval), 1), this.p.maximum_interval);
    };
    _proto2.next_difficulty = function next_difficulty(d, r) {
        var next_d = d - this.p.w[6] * (r - 3);
        return Math.min(Math.max(this.mean_reversion(this.p.w[4], next_d), 1), 10);
    };
    _proto2.mean_reversion = function mean_reversion(init, current) {
        return this.p.w[7] * init + (1 - this.p.w[7]) * current;
    };
    _proto2.next_recall_stability = function next_recall_stability(d, s, r, rating) {
        var hard_penalty = rating === Rating.Hard ? this.p.w[15] : 1;
        var easy_bonus = rating === Rating.Easy ? this.p.w[16] : 1;
        return s * (1 + Math.exp(this.p.w[8]) * (11 - d) * Math.pow(s, -this.p.w[9]) * (Math.exp((1 - r) * this.p.w[10]) - 1) * hard_penalty * easy_bonus);
    };
    _proto2.next_forget_stability = function next_forget_stability(d, s, r) {
        return this.p.w[11] * Math.pow(d, -this.p.w[12]) * (Math.pow(s + 1, this.p.w[13]) - 1) * Math.exp((1 - r) * this.p.w[14]);
    };
    return FSRS;
}();

let fsrs = new FSRS();

const millisecondsPerMinute = 1000 * 60;
const millisecondsPerHour = millisecondsPerMinute * 60;
const millisecondsPerDay = millisecondsPerHour * 24;

function getDaysInterval(startDate, endDate) {
    const differenceInMilliseconds = endDate - startDate;
    return differenceInMilliseconds / millisecondsPerDay;
}

function addDaysToDate(date, days) {
    const millisecondsToAdd = days * millisecondsPerDay;
    return new Date(date.getTime() + millisecondsToAdd);
}

function printInterval(date1, date2) {
    let difference = Math.abs(date2 - date1);

    const days = Math.floor(difference / millisecondsPerDay);
    difference -= days * millisecondsPerDay;

    const hours = Math.floor(difference / millisecondsPerHour);
    difference -= hours * millisecondsPerHour;

    const minutes = Math.floor(difference / millisecondsPerMinute);

    console.log(`${days}:${hours}:${minutes}`);
}

function srsFunc(previous, evaluation) {
    if (previous == null) {
        let card = new Card();
        previous = { n: 0, interval: 0, efactor: 0, data: card }
    } else if (previous.data == null || previous.data.due == null || previous.data.last_review == null) {
        // ensure we reuse the previous n, interval, and efactor, but overwrite data field
        previous = { ...previous, data: new Card() };
    } else {
        // previous.data field looks valid, but we must convert the due and laast_review fields from strings to Date
        // objects.
        previous.data.due = new Date(previous.data.due)
        previous.data.last_review = new Date(previous.data.last_review)
    }

    var rating;
    if (evaluation.score < 3) {
        rating = Rating.Again;
    } else if (evaluation.score < 4) {
        rating = Rating.Hard;
    } else if (evaluation.score < 5) {
        rating = Rating.Good;
    } else {
        rating = Rating.Easy;
    }

    let now = addDaysToDate(previous.data.due, evaluation.lateness);
    let schedule = fsrs.repeat(previous.data, now);
    let newCard = schedule[rating].card;
    let interval = getDaysInterval(now, newCard.due)

    // data field must consist entirely of JSON-serializable values, so let's convert the due and last_review fields to
    // strings, which can be serialized. When we load previous.data.due and previous.data.last_review, we must convert
    // back to Date objects from the strings.
    let data = { ...newCard, due: newCard.due.toString(), last_review: newCard.last_review.toString() }

    var newN = evaluation.score < 3 ? 0 : previous.n + 1;
    return {
        n: newN,
        efactor: newCard.difficulty,
        interval: interval,
        data: data
    }
}
