export enum ImageType {
    png = 'png',
    jpeg = 'mozjpeg',
    webp = 'webp',
}

export const imageTypes = Object.values(ImageType);

export enum ResizePreset {
    // noinspection JSUnusedGlobalSymbols
    '25%' = '0.25',
    '33.33%' = '0.3333',
    '50%' = '0.5',
    '100%' = '1',
    '200%' = '2',
    '300%' = '3',
    '400%' = '4',
}

export enum Color {
    red = 31,
    green = 32,
    blue = 34,
    cyan = 36
}

export enum VarType {
    notEmpty,
    inListOrEmpty,
    inRangeOrEmpty,
    isList,
    isBool,
    whatever
}
