//% color=#00A6ED icon="\uf2a2" block="Ultrasonic"
namespace ultrasonic {
    /**
     * Units for distance.
     */
    export enum Unit {
        //% block="cm"
        Centimeters = 0,
        //% block="inch"
        Inches = 1
    }

    let _trig: DigitalPin = DigitalPin.P1
    let _echo: DigitalPin = DigitalPin.P0
    let _maxUs = 25000 // ~4.3m round-trip timeout in microseconds
    let _polling = false

    /**
     * Select the trigger and echo pins
     */
    //% blockId=ultra_set_pins
    //% block="set ultrasonic pins|TRIG %trig|ECHO %echo"
    //% trig.defl=DigitalPin.P1 echo.defl=DigitalPin.P2
    //% weight=90
    export function setPins(trig: DigitalPin, echo: DigitalPin): void {
        _trig = trig
        _echo = echo
        pins.setPull(_echo, PinPullMode.PullNone)
        // make sure trigger is low initially
        pins.digitalWritePin(_trig, 0)
        control.waitMicros(5)
    }

    /**
     * Set the maximum measurable distance (timeout)
     * (e.g., 25,000µs ≈ 4.3m; 12,000µs ≈ ~2m)
     */
    //% blockId=ultra_set_timeout
    //% block="set ultrasonic max time %maxMicros µs"
    //% maxMicros.min=3000 maxMicros.max=40000 maxMicros.defl=25000
    //% group="Advanced"
    //% weight=10
    export function setMaxMicros(maxMicros: number): void {
        _maxUs = Math.max(3000, Math.min(40000, maxMicros | 0))
    }

    /**
     * Read distance once in centimeters.
     */
    //% blockId=ultra_read_cm_once
    //% block="ultrasonic distance (cm)"
    //% weight=85
    export function distanceCm(): number {
        return read(Unit.Centimeters, 1)
    }

    /**
     * Read distance with optional averaging and units.
     */
    //% blockId=ultra_read
    //% block="ultrasonic distance in %unit averaging %samples samples"
    //% samples.min=1 samples.max=10 samples.defl=3
    //% weight=80
    export function read(unit: Unit = Unit.Centimeters, samples: number = 3): number {
        samples = Math.max(1, Math.min(10, samples | 0))
        let sum = 0
        let cnt = 0
        for (let i = 0; i < samples; i++) {
            const cm = measureOnceCm()
            if (cm > 0) {
                sum += cm
                cnt++
            }
            basic.pause(10)
        }
        let cmAvg = cnt > 0 ? sum / cnt : 0
        if (unit == Unit.Inches) return cmAvg / 2.54
        return cmAvg
    }

    /**
     * Fire a tiny 10µs trigger, measure echo high pulse, convert to cm.
     * HC-SR04: distance(cm) ≈ duration(µs) / 58
     */
    function measureOnceCm(): number {
        // ensure clean low
        pins.digitalWritePin(_trig, 0)
        control.waitMicros(2)

        // 10µs HIGH pulse on TRIG
        pins.digitalWritePin(_trig, 1)
        control.waitMicros(10)
        pins.digitalWritePin(_trig, 0)

        // measure ECHO high time (round-trip)
        const d = pins.pulseIn(_echo, PulseValue.High, _maxUs)
        if (d <= 0) return 0

        // convert to cm; 58 is standard factor for HC-SR04
        const cm = d / 58
        return cm
    }

    /**
     * Run code when distance (in cm) is less than a threshold.
     * Uses a background poll (~every 50ms).
     */
    //% blockId=ultra_on_less
    //% block="on ultrasonic < %threshold cm"
    //% threshold.min=2 threshold.max=400 threshold.defl=10
    //% draggableParameters="reporter"
    //% weight=70
    export function onDistanceLessThan(threshold: number, handler: (currentCm: number) => void): void {
        threshold = Math.max(2, Math.min(400, threshold | 0))
        if (_polling) {
            // already polling — just add another handler
            control.inBackground(() => {
                while (true) {
                    const cm = distanceCm()
                    if (cm > 0 && cm < threshold) handler(cm)
                    basic.pause(50)
                }
            })
            return
        }
        _polling = true
        control.inBackground(() => {
            while (true) {
                const cm = distanceCm()
                if (cm > 0 && cm < threshold) handler(cm)
                basic.pause(50)
            }
        })
    }
}
