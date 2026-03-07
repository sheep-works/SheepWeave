import { LmLgUnit } from './LmLgUnit';

export class LmLgBody {
    units: LmLgUnit[];

    constructor(units: LmLgUnit[] = []) {
        this.units = units;
    }
}
