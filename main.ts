//% color=#00A6ED icon="\uf2a2" block="Ultrasonic"
namespace ultrasonic33 {
    export enum Unit { Centimeters = 0, Inches = 1 }

    let _trig: DigitalPin = DigitalPin.P1
    let _echo: DigitalPin = DigitalPin.P2
    // Push timeouts higher because at 3.3 V the front-end is slow
    let _maxUs = 40000 // up to ~6.9 m round-trip
    let _settleUs = 600 // time after trigger to let the module settle

    //% blockId=u33_setpins block="set ultrasonic pins TRIG %trig ECHO %echo"
    //% trig.defl=DigitalPin.P1 echo.defl=DigitalPin.P2
    export function setPins(trig: DigitalPin, echo: DigitalPin) {
        _trig = trig; _echo = echo
        pins.setPull(_echo, PinPullMode.PullNone)
        pins.digitalWritePin(_trig, 0)
        basic.pause(10)
    }

    //% blockId=u33_settimeouts block="set ultrasonic max time %maxMicros µs and settle %settleMicros µs"
    //% maxMicros.min=15000 maxMicros.max=60000 maxMicros.defl=40000
    //% settleMicros.min=100 settleMicros.max=2000 settleMicros.defl=600
    //% group="Advanced"
    export function setTiming(maxMicros: number, settleMicros: number) {
        _maxUs = Math.max(15000, Math.min(60000, maxMicros | 0))
        _settleUs = Math.max(100, Math.min(2000, settleMicros | 0))
    }

    //% blockId=u33_distance block="ultrasonic distance in %unit averaging %samples samples"
    //% samples.min=1 samples.max=9 samples.defl=5
    export function distance(unit: Unit = Unit.Centimeters, samples = 5): number {
        const vals: number[] = []
        for (let i = 0; i < samples; i++) {
            const cm = measureOnceCmRobust()
            if (cm > 0) vals.push(cm)
            basic.pause(20)
        }
        if (vals.length === 0) return 0
        // median is more stable with occasional zeros
        vals.sort((a, b) => a - b)
        const med = vals[vals.length >> 1]
        return unit === Unit.Inches ? med / 2.54 : med
    }

    // Try hard to get a reading at 3.3 V
    function measureOnceCmRobust(): number {
        // a) pre-condition line low
        pins.digitalWritePin(_trig, 0)
        control.waitMicros(4)

        // b) stronger/longer trigger (30 µs)
        pins.digitalWritePin(_trig, 1)
        control.waitMicros(30)
        pins.digitalWritePin(_trig, 0)

        // c) allow internal comparator/transducer to wake up
        control.waitMicros(_settleUs)

        // d) attempt 1: normal HIGH pulse (most modules)
        let dur = pins.pulseIn(_echo, PulseValue.High, _maxUs)
        if (dur <= 0) {
            // e) attempt 2: some clones expose a LOW pulse instead
            dur = pins.pulseIn(_echo, PulseValue.Low, _maxUs)
        }
        if (dur <= 0) {
            // f) attempt 3: quick re-trigger (double-ping helps some units)
            control.waitMicros(200)
            pins.digitalWritePin(_trig, 1)
            control.waitMicros(20)
            pins.digitalWritePin(_trig, 0)
            control.waitMicros(_settleUs)
            dur = pins.pulseIn(_echo, PulseValue.High, _maxUs)
            if (dur <= 0) dur = pins.pulseIn(_echo, PulseValue.Low, _maxUs)
        }
        if (dur <= 0) return 0

        // µs → cm (HC-SR04 ≈ d/58)
        return dur / 58
    }
}
