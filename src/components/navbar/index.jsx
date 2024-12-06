import React from 'react'
import Container from 'react-bootstrap/Container'
import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import NavDropdown from 'react-bootstrap/NavDropdown'


class NavBar extends React.Component {
    render() {
        return (
            <Navbar bg="light" expand="lg">
                <Container>
                <Navbar.Brand href="/">Gillham-Net Tools</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                    {/* <Nav.Link href="/">Home</Nav.Link> */}
                    <NavDropdown title="Tools" id="basic-nav-dropdown">
                        <NavDropdown.Item href="/gpx-parser">GPX Parser</NavDropdown.Item>
                        <NavDropdown.Item href="/moving-network-speed-test">Moving Network Speed Test</NavDropdown.Item>
                    </NavDropdown>
                    </Nav>
                </Navbar.Collapse>
                </Container>
            </Navbar>
        )
    }
}

export default NavBar