import React, { useEffect } from 'react';
import { NextPageContext } from 'next';

import NotFoundPage from "./404"


interface ErrorProps {
  statusCode: number;
  onReady: () => void;
}

class ErrorPage extends React.Component<ErrorProps> {
  static getInitialProps({ res, err }: NextPageContext) {
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
    return { statusCode };
  }
  
  render() {
    this.props.onReady();
    
    if (this.props.statusCode === 404) {
        return <NotFoundPage />;
    }

    return <NotFoundPage errorCode={this.props.statusCode || 500} />;
  }
}

export default ErrorPage;