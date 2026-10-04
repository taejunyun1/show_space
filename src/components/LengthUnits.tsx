import {createContext, useContext} from 'react';
import {formatLength, type LengthUnit} from '../domain/lengthUnits';
export const LengthUnitContext = createContext<LengthUnit>('mm');
export function useLengthUnit() { return useContext(LengthUnitContext); }
export function useLengthFormatter() { const unit = useLengthUnit(); return (value: number) => formatLength(value, unit); }
