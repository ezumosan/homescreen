import SwiftUI

extension Color {
    static var appBackground: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(Color(hex: "0f0f1a")) : UIColor(Color(hex: "f4f4f5"))
        })
    }
    
    static var appCard: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(Color(hex: "1a1a2e")) : UIColor(Color(hex: "ffffff"))
        })
    }
    
    static var appTextPrimary: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor.white : UIColor.black
        })
    }
    
    static var appTextSecondary: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(white: 1.0, alpha: 0.5) : UIColor(white: 0.0, alpha: 0.5)
        })
    }
    
    static var appBorder: Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(white: 1.0, alpha: 0.06) : UIColor(white: 0.0, alpha: 0.06)
        })
    }
}
