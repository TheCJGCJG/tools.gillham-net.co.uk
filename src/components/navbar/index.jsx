import React from 'react'

class NavBar extends React.Component {
    constructor(props) {
        super(props)
        this.state = { mobileOpen: false, dropdownOpen: false }
        this.toggleMobile = this.toggleMobile.bind(this)
        this.toggleDropdown = this.toggleDropdown.bind(this)
    }

    toggleMobile() {
        this.setState(s => ({ mobileOpen: !s.mobileOpen }))
    }

    toggleDropdown() {
        this.setState(s => ({ dropdownOpen: !s.dropdownOpen }))
    }

    render() {
        const { mobileOpen, dropdownOpen } = this.state
        return (
            <nav data-testid="navbar" className="sticky top-0 z-50 border-b border-gray-100/50 backdrop-blur-sm bg-white/80">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="flex items-center justify-between h-14">
                        {/* Brand */}
                        <a data-testid="navbar-brand" href="/" className="font-bold text-gray-900 hover:text-indigo-600 transition-colors text-lg">
                            Gillham-Net Tools
                        </a>

                        {/* Desktop nav */}
                        <div data-testid="navbar-collapse" id="basic-navbar-nav" className="hidden md:flex items-center gap-6">
                            <nav data-testid="nav" className="flex items-center gap-6">
                                <div data-testid="nav-dropdown" data-title="Tools" className="relative" id="basic-nav-dropdown">
                                    <button
                                        onClick={this.toggleDropdown}
                                        className="relative group text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200 flex items-center gap-1"
                                    >
                                        Tools
                                        <span className="text-xs">{dropdownOpen ? '▲' : '▼'}</span>
                                        <span className="absolute bottom-0 left-0 w-0 h-0.5 gradient-accent group-hover:w-full transition-all duration-300"></span>
                                    </button>
                                    {dropdownOpen && (
                                        <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-gray-100 shadow-card-hover py-1 z-50">
                                            <a data-testid="dropdown-item" href="/gpx-parser"
                                               className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 transition-colors"
                                               onClick={() => this.setState({ dropdownOpen: false })}>
                                                GPX Parser
                                            </a>
                                            <a data-testid="dropdown-item" href="/moving-network-speed-test"
                                               className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 transition-colors"
                                               onClick={() => this.setState({ dropdownOpen: false })}>
                                                Moving Network Speed Test
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </nav>
                        </div>

                        {/* Mobile hamburger */}
                        <button
                            data-testid="navbar-toggle"
                            aria-controls="basic-navbar-nav"
                            onClick={this.toggleMobile}
                            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <span className="sr-only">Toggle navigation</span>
                            <div className="w-5 h-0.5 bg-current mb-1"></div>
                            <div className="w-5 h-0.5 bg-current mb-1"></div>
                            <div className="w-5 h-0.5 bg-current"></div>
                        </button>
                    </div>

                    {/* Mobile menu */}
                    {mobileOpen && (
                        <div className="md:hidden border-t border-gray-100 py-3">
                            <a data-testid="dropdown-item" href="/gpx-parser"
                               className="block px-2 py-2 text-sm text-gray-700 hover:text-indigo-600 transition-colors">
                                GPX Parser
                            </a>
                            <a data-testid="dropdown-item" href="/moving-network-speed-test"
                               className="block px-2 py-2 text-sm text-gray-700 hover:text-indigo-600 transition-colors">
                                Moving Network Speed Test
                            </a>
                        </div>
                    )}
                </div>
            </nav>
        )
    }
}

export default NavBar
