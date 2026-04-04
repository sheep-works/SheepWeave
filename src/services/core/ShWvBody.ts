import { ShWvUnit } from './ShWvUnit';

export class ShWvBody {
    units: ShWvUnit[];

    constructor(units: ShWvUnit[] = []) {
        this.units = units;
    }
}
