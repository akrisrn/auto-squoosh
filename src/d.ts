import { ImageType } from './enums';

export type ImageFile = {
    path: string,
    width: number,
    height: number
}

export type CustomRule = {
    inputType?: ImageType
    outputType: ImageType
}
