import 'styled-components';

declare module 'styled-components' {
    export interface DefaultTheme {
        colors: {
            primary: string;
            secondary: string;
            background: string;
            backgroundAlt: string;
            text: {
                primary: string;
                secondary: string;
            };
            border: string;
            disabled: string;
            success: string;
            error: string;
            warning: string;
        };
        fonts: {
            body: string;
            heading: string;
        };
        fontSizes: {
            small: string;
            medium: string;
            large: string;
            xlarge: string;
        };
        spacing: {
            small: string;
            medium: string;
            large: string;
        };
        borderRadius: {
            small: string;
            medium: string;
            large: string;
        };
        shadows: {
            small: string;
            medium: string;
            large: string;
        };
    }
} 