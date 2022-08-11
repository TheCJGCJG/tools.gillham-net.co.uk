import React from 'react'
import Container from 'react-bootstrap/Container';

class HomePage extends React.Component {
    render() {
        return (
            <Container>
                <h1>Home</h1>
                <h4>What is this?</h4>
                <p>This is just a little scrappy site where I have put some useful JavaScript utilities</p>

                <h3>Other Places You Can Go</h3>
                <p><a href="https://www.gillham-net.co.uk">My Website</a></p>
                <p><a href="https://github.com/TheCJGCJG/tools.gillham-net.co.uk">Github Repository for this site</a></p>
            </Container>
        )
    }
}

export default HomePage